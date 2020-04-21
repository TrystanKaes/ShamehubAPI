var express = require('express');
var bodyParser = require('body-parser');
var passport = require('passport');
var authJwtController = require('./auth_jwt');
var User = require('./Users');
var Insult = require('./Insults');
var jwt = require('jsonwebtoken');
var cors = require('cors');
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

var app = express();
module.exports = app; // for testing
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cors());

app.use(passport.initialize());

var router = express.Router();


function strMapToObj(strMap) {
    let obj = Object.create(null);
    for (let [k,v] of strMap) {
        // We don’t escape the key '__proto__'
        // which can cause problems on older engines
        obj[k] = v;
    }
    return obj;
}
function objToStrMap(obj) {
    let strMap = new Map();
    for (let k of Object.keys(obj)) {
        strMap.set(k, obj[k]);
    }
    return strMap;
}


router.route('/github-user/:gitUser')
    .get(function(req, res)
        {
            var git_user = req.params.gitUser;
            if (!req.params.gitUser) {
                res.json({success: false, message: 'Please pass a Github username!'});
            } else {
                let dict = new Map();
                let repo_names = [];
                let commit_messages = [];
                let commit_dates = [];

                const xhr = new XMLHttpRequest();
                const name = new XMLHttpRequest();
                const commits = new XMLHttpRequest();


                let url = 'https://api.github.com/';
                let repo, commit;
                let profile_name, profile_bio, profile_img;

                // GET /repos/:owner/:repo/git/commits/:commit_sha
                // https://api.github.com/repos/xfrenchy/battleship/commits
                profile_name = url.concat(git_user);
                repo = url.concat("users/").concat(git_user).concat("/repos");

                //open requests
                xhr.open('GET', repo, false);
                name.open('GET', profile_name, false);

                xhr.send();
                name.send();

                const data = JSON.parse(xhr.responseText)
                const data1 = JSON.parse(name.responseText);

                for (let i in data) {
                    repo_names.push(data[i].name);
                }

                let commit_url = "";
                for (let i in repo_names){
                    commit_url = url.concat("repos/").concat(git_user).concat("/",repo_names[i]).concat("/commits");
                    commits.open("GET", commit_url, false);
                    commits.send();
                    let data2 = JSON.parse(commits.responseText);
                    // Inner for loop, responsible for pushing all commits for each repo into the commit_messages array
                    for (let x in data2){
                        commit_messages.push(data2[x].commit.message)
                    }
                }

                for (let key in data1){
                    if(key == "name") {
                        profile_name = data1[key];
                    }else if(key == "bio"){
                        profile_bio = data1[key];
                    }else if(key == "avatar_url"){
                        profile_img = data1[key];
                    }
                }

                dict.set("name_key", profile_name);
                dict.set("bio_key", profile_bio);
                dict.set("img_key", profile_img);
                dict.set("repo_key", repo_names);
                dict.set("commits_key", commit_messages);

                JSONObj = new Object();
                JSONObj = strMapToObj(dict);


                res.json({success: true, message: JSONObj});
            }
        }
    );



router.route('/postjwt')
    .post(authJwtController.isAuthenticated, function (req, res) {
            console.log(req.body);
            res = res.status(200);
            if (req.get('Content-Type')) {
                console.log("Content-Type: " + req.get('Content-Type'));
                res = res.type(req.get('Content-Type'));
            }
            res.send(req.body);
        }
    );

router.route('/users/:username')
    .get(authJwtController.isAuthenticated, function (req, res) {
        var username = req.params.username
        User.findOne({ username: username }).select('name username password').exec(function(err, user) {
            if (err) res.send(err);
            var userJson = JSON.stringify(user);
            res.json(userJson);
        });
    });

router.route('/users')
    .get(authJwtController.isAuthenticated, function (req, res) {
        User.find(function (err, users) {
            if (err) res.send(err);
            // return the users
            res.json(users);
        });
    });

router.post('/signup', function(req, res) {
    if (!req.body.username || !req.body.password) {
        res.json({success: false, message: 'Please pass username and password.'});
    }
    else {
        var user = new User();
        user.name = req.body.name;
        user.username = req.body.username;
        user.password = req.body.password;
        // save the user
        user.save(function(err) {
            if (err) {
                // duplicate entry
                if (err.code == 11000)
                    return res.status(400).send({ success: false, message: 'A user with that username already exists. '});
                else
                    return res.send(err);
            }

            res.json({ success: true, message: 'User created!' });
        });
    }
});

router.route('/insults/:category')
    .get(function(req, res) {
        var insult = new Insult()
        insult.category = req.params.category;
        Insult.aggregate([{ $match: { category: req.params.category } }, { $sample: { size: 1 } }]).exec(function (err, insult) {
            if (insult[0]){
                res.status(200).send({msg: "get random insult", insult: insult[0]})
            }
            else res.status(400).send({msg: "no insults exist for this category"})
        })
    })

router.route('/insults')
    .get(function (req, res) {
        if (req.body.category){
            var insult = new Insult()
            insult.category = req.body.category;
            Insult.aggregate([{ $match: { category: req.body.category } }, { $sample: { size: 1 } }]).exec(function (err, insult) {
                if (insult[0]){
                    res.status(200).send({msg: "get random insult", insult: insult[0]})
                }
                else res.status(400).send({msg: "no insults exist for this category"})
            })
        }
        else {
            Insult.find().select('insult category').exec(function (err, insults) {
                if (err) res.send(err);
                res.status(200).send({msg: "GET insults", insults: insults});
            })
        }
    })
    .post(function (req, res) {
        console.log("called post function");
        var insult = new Insult();
        insult.insult = req.body.insult;
        insult.category = req.body.category;
        insult.save(function(err) {
            if (err) {
                // duplicate entry
                console.log("called save function");
                if (err.code == 11000)
                    return res.status(400).json({ success: false, message: 'That exact insult already exists'});
                else
                    return res.status(400).send(err);
            }
            res.json({ success: true, message: 'Insult created!' });
        });
    });

    router.post('/signin', function(req, res) {
        var userNew = new User();
        userNew.name = req.body.name;
        userNew.username = req.body.username;
        userNew.password = req.body.password;

        User.findOne({ username: userNew.username }).select('name username password').exec(function(err, user) {
            if (err) res.send(err);
            if (user){
                user.comparePassword(userNew.password, function(isMatch){
                    if (isMatch) {
                        var userToken = {id: user._id, username: user.username};
                        var token = jwt.sign(userToken, process.env.SECRET_KEY);
                        res.json({success: true, token: 'JWT ' + token});
                    }
                    else {
                        res.status(401).send({success: false, message: 'incorrect-password'});
                    }
                });
            }
            else
                res.status(401).send({success: false, message: 'username-not-found'})
        });
    });



app.use('/', router);
app.listen(process.env.PORT || 8080);
