var express = require('express');
var bodyParser = require('body-parser');
var passport = require('passport');
var authJwtController = require('./auth_jwt');
var User = require('./Users');
var Insult = require('./Insults');
var jwt = require('jsonwebtoken');
var cors = require('cors');
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
var btoa = require('btoa');

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
//TODO optimize and make code look pretty
//retrieves all information about a user, this is like initializing all the data of a user
function fetchAllUserData(username) {
    //create requests that we will be sending eventually
    const repo = new XMLHttpRequest();
    const profile = new XMLHttpRequest();
    const commits = new XMLHttpRequest();

    let url = 'https://api.github.com/';
    let profile_bio, profile_img;

    // GET /repos/:owner/:repo/git/commits/:commit_sha
    // https://api.github.com/repos/xFrenchy/Battleship/commits
    let profile_name = url.concat("users/").concat(username);
    let repo_path = url.concat("users/").concat(username).concat("/repos");

    //open requests
    repo.open('GET', repo_path, false);
    profile.open('GET', profile_name, false);
    //set authentication for open requests
    repo.setRequestHeader("Authorization", "Basic " + btoa(process.env.CLIENT_TOKEN));
    profile.setRequestHeader("Authorization", "Basic " + btoa(process.env.CLIENT_TOKEN));
    //send requests
    repo.send();
    profile.send();

    const repo_data = JSON.parse(repo.responseText);
    const profile_data = JSON.parse(profile.responseText);

    //retrieve name, bio, and image url
    profile_name = profile_data['name'];
    profile_bio = profile_data['bio'];
    profile_img = profile_data['avatar_url'];

    //JSON to store repos and commits
    let repo_info = {
        repo_names: [],
        posts: []
    };
    let commit_info = {
        commit_msg: '',
        commit_date: '',
        repo_name: '',
        author_name: '',
        login_name: ''
    };

    let repo_names = [];
    for (let i in repo_data) {
        repo_names.push(repo_data[i].name);
        repo_info['repo_names'].push(repo_data[i].name);
    }

    //for loop to retrieve commits from all repos of the user
    for (let i in repo_names){
        let commit_url = url.concat("repos/").concat(username).concat("/",repo_names[i]).concat("/commits");
        commits.open("GET", commit_url, false);
        commits.setRequestHeader("Authorization", "Basic " + btoa(process.env.CLIENT_TOKEN));
        commits.send();
        let commit_data = JSON.parse(commits.responseText);
        // Inner for loop, responsible for pushing all commits for each repo into the commit_messages array
        if(commit_data.message === undefined) {
            for (let x in commit_data) {
                commit_info['commit_msg'] = commit_data[x].commit.message;
                commit_info['commit_date'] = commit_data[x].commit.author.date;
                commit_info['repo_name'] = repo_names[i];
                commit_info['author_name'] = commit_data[x].commit.author.name;
                commit_info['login_name'] = commit_data[x].author ? commit_data[x].author.login : null; //some accounts might have author set to null
                let jsonCopy2 = Object.assign({}, commit_info); //need to deep copy so that next changes don't affect previous JSON objects (immutable vs mutable change)
                repo_info['posts'].push(jsonCopy2);
            }
        }
        else{
            //This repo is empty
            commit_info['commit_msg'] = null;
            commit_info['commit_date'] = null;
            commit_info['repo_name'] = repo_names[i];
            commit_info['author_name'] = null;
            commit_info['login_name'] = null; //some accounts might have author set to null
            let jsonCopy2 = Object.assign({}, commit_info); //need to deep copy so that next changes don't affect previous JSON objects (immutable vs mutable change)
            repo_info['posts'].push(jsonCopy2);
        }
    }

    //map it all for the purpose of creating a new JSON object
    let dict = new Map();
    dict.set("name_key", profile_name);
    dict.set("bio_key", profile_bio);
    dict.set("img_key", profile_img);
    dict.set("repo_info", repo_info);
    //create new json object with dict keys
    let JSONObj = new Object();
    JSONObj = strMapToObj(dict);
    //return our JSON
    return JSONObj;
}
//retrieves all information about the users profile such as name, bio, picture, and returns it
function fetchProfileData(username){
    //create XMLHttp object
    const profile = new XMLHttpRequest();
    //create path for request
    let profile_path = 'https://api.github.com/users/'.concat(username);
    //open request
    profile.open('GET', profile_path, false);
    profile.setRequestHeader("Authorization", "Basic " + btoa(process.env.CLIENT_TOKEN));
    //send request
    profile.send();
    //parse response
    const data = JSON.parse(profile.responseText);
    //retrieve name, bio, and image url
    let profile_name = data['name'];
    let profile_bio = data['bio'];
    let profile_img = data['avatar_url'];
    //return JSON
    let dict = new Map();
    dict.set("name_key", profile_name);
    dict.set("bio_key", profile_bio);
    dict.set("img_key", profile_img);
    JSONObj = new Object();
    JSONObj = strMapToObj(dict);
    return JSONObj;
}
//retrieves all commits from a specific repo of a specific user and returns it
function fetchCommitData(username, repo_name, current_commits){
    //create XMLHttp object
    const commits = new XMLHttpRequest();
    //create path for request
    let commit_path = 'https://api.github.com/repos/'.concat(username).concat('/', repo_name).concat('/commits');
    //open request
    commits.open('GET', commit_path, false);
    commits.setRequestHeader("Authorization", "Basic " + btoa(process.env.CLIENT_TOKEN));
    //send request
    commits.send();
    //parse response
    const commit_data = JSON.parse(commits.responseText);
    //JSON to store commits
    let posts = [];
    let new_commits = [];
    let commit_info = {
        commit_msg: '',
        commit_date: '',
        repo_name: '',
        author_name: '',
        login_name: ''
    };

    //retrieve commit messages
    for (let x in commit_data){
        commit_info['commit_msg'] = commit_data[x].commit.message;
        commit_info['commit_date'] = commit_data[x].commit.author.date;
        commit_info['repo_name'] = repo_name;
        commit_info['author_name'] = commit_data[x].commit.author.name;
        commit_info['login_name'] = commit_data[x].author.login;
        let jsonCopy2 = Object.assign({}, commit_info);
        posts.push(jsonCopy2);
    }

    //Figure out if there has been any new commits by checking if this commit exists
    for(let i = 0; i < posts.length; ++i){
        //That's a chunky if statement woo
        // https://stackoverflow.com/questions/8217419/how-to-determine-if-javascript-array-contains-an-object-with-an-attribute-that-e/8217584#8217584
        if(!current_commits.some(e => e.commit_msg === posts[i].commit_msg && e.commit_date === posts[i].commit_date)){
            new_commits.push(posts[i]);
        }
    }
    //if there was no new commits detected
    if(new_commits.length === 0){
        new_commits = null;
    }

    //map it all for the purpose of creating a new JSON object
    let dict = new Map();
    dict.set("new_commits", new_commits);
    dict.set("posts", posts);
    //create new json object with dict keys
    let JSONObj = new Object();
    JSONObj = strMapToObj(dict);
    //return our JSON
    return JSONObj;
}
//retrieves all repos from a specific user and updates the schema
function fetchRepoData(username){
    //create XMLHttp object
    const repo = new XMLHttpRequest();
    //create path for request
    let repo_path = 'https://api.github.com/users/'.concat(username).concat('/repos');
    //open request
    repo.open('GET', repo_path, false);
    repo.setRequestHeader("Authorization", "Basic " + btoa(process.env.CLIENT_TOKEN));
    //send request
    repo.send();
    //parse response
    const repo_data = JSON.parse(repo.responseText);
    //retrieve all repo names
    let repo_names = [];
    for (let i in repo_data) {
        repo_names.push(repo_data[i].name);
    }
    //return array of all repo names
    return repo_names;
}
//retrieves all repos and commit data from the user but not the profile, updates new_commits
function fetchAllRepoCommitData(username, current_commits){
    //create requests that we will be sending eventually
    const repo = new XMLHttpRequest();
    const commits = new XMLHttpRequest();

    let url = 'https://api.github.com/';

    // GET /repos/:owner/:repo/git/commits/:commit_sha
    // https://api.github.com/repos/xFrenchy/Battleship/commits
    let repo_path = url.concat("users/").concat(username).concat("/repos");

    //open requests
    repo.open('GET', repo_path, false);
    //set authentication for open requests
    repo.setRequestHeader("Authorization", "Basic " + btoa(process.env.CLIENT_TOKEN));
    //send requests
    repo.send();

    const repo_data = JSON.parse(repo.responseText);

    //JSON to store repos and commits
    let repo_info = {
        repo_names: [],
        posts: []
    };
    let commit_info = {
        commit_msg: '',
        commit_date: '',
        repo_name: '',
        author_name: '',
        login_name: ''
    };
    let new_commits = [];

    let repo_names = [];
    for (let i in repo_data) {
        repo_names.push(repo_data[i].name);
        repo_info['repo_names'].push(repo_data[i].name);
    }

    //for loop to retrieve commits from all repos of the user
    for (let i in repo_names){
        let commit_url = url.concat("repos/").concat(username).concat("/",repo_names[i]).concat("/commits");
        commits.open("GET", commit_url, false);
        commits.setRequestHeader("Authorization", "Basic " + btoa(process.env.CLIENT_TOKEN));
        commits.send();
        let commit_data = JSON.parse(commits.responseText);
        // Inner for loop, responsible for pushing all commits for each repo into the commit_messages array

        for (let x in commit_data){
            commit_info['commit_msg'] = commit_data[x].commit.message;
            commit_info['commit_date'] = commit_data[x].commit.author.date;
            commit_info['repo_name'] = repo_names[i];
            commit_info['author_name'] = commit_data[x].commit.author.name;
            commit_info['login_name'] = commit_data[x].author.login;
            let jsonCopy2 = Object.assign({}, commit_info); //need to deep copy so that next changes don't affect previous JSON objects (immutable vs mutable change)
            repo_info['posts'].push(jsonCopy2);
        }
    }
    //Figure out if there has been any new commits by checking if this commit exists
    for(let i = 0; i < Object.keys(repo_info['posts']).length; ++i){
        //That's a chunky if statement woo
        // https://stackoverflow.com/questions/8217419/how-to-determine-if-javascript-array-contains-an-object-with-an-attribute-that-e/8217584#8217584
        if(!current_commits.some(e => e.commit_msg === repo_info['posts'][i].commit_msg && e.commit_date === repo_info['posts'][i].commit_date)){
            new_commits.push(repo_info['posts'][i]);
        }
    }
    //if there was no new commits detected
    if(new_commits.length === 0){
        new_commits = null;
    }

    //map it all for the purpose of creating a new JSON object
    let dict = new Map();
    dict.set("new_commits", new_commits);
    dict.set("repo_info", repo_info);
    //create new json object with dict keys
    let JSONObj = new Object();
    JSONObj = strMapToObj(dict);
    //return our JSON
    return JSONObj;
}

router.route('/limit')
    .get(function(req, res){
        const limit = new XMLHttpRequest();
        //create path for request
        let limit_path = 'https://api.github.com/rate_limit';
        //open request
        limit.open('GET', limit_path, false);
        //set header for authentication
        limit.setRequestHeader("Authorization", "Basic " + btoa(process.env.CLIENT_TOKEN));
        //send request
        limit.send();
        //send response
        res.status(limit.status).send(JSON.parse(limit.responseText));
    });

//changing the start index to be optional
router.route('/discoveryFeed/:start?')
    .get(authJwtController.isAuthenticated, function(req, res){
        //retrieve the new_commits field from all users, sort it based on date, starting index at n * 20, return 20 from that starting index
        User.find({user_feed: {$exists: true}}, 'user_feed', function(err, doc){
            if(err) res.status(400).send(err);
            //let's combine all of these user feeds together into one big feed
            let discovery_field = [];
            for(let i = 0; i < doc.length; ++i){
                let size = doc[i]._doc.user_feed.length// > 20 ? 20 : doc[i]._doc.user_feed.length;
                for(let j = 0; j < size; ++j){
                    discovery_field.push(doc[i]._doc.user_feed[j]);
                }
            }
            //sort discovery field based on the date
            discovery_field.sort((a,b) => {
               let comparison = 0;
               if(a.commit_date < b.commit_date){
                   comparison = 1;
               }
               else if(a.commit_date > b.commit_date){
                    comparison = -1;
               }
               else{
                    //well the dates are equal
                   comparison = 0;
               }
               return comparison;
            } );
            //return the first 20 elements
            //let index = req.params.start;   //not needed anymore if we don't manipulate index. Staying in case we change our mind
            if(req.params.start >= discovery_field.length){
                res.status(400).send({success: false, msg: 'The index you gave me is out of bounds!The discovery field is not that big'});
            }
            else {
                let returnJson = {
                    success: true,
                    msg: 'Successfully retrieved the discovery field',
                    discovery_field: discovery_field//.slice(index, index + 20)
                };
                res.status(200).send(returnJson);
            }
        })
    });

//shamehub username, not github username
router.route('/userfeed/:username/:start?')
    .get(authJwtController.isAuthenticated, function(req,res){
        // if(req.params.start){
            //let index = req.params.start;   //this is not needed if we're not manipulating the index anymore
            User.findOne({username: req.params.username}, 'user_feed', function(err, feed){
                if(err){
                    res.status(400).send(err);
                }
                if(feed.user_feed === undefined){
                    res.status(400).send({success: false, msg: 'userfeed has not been created yet! Try doing a POST to create a userfeed before you try a GET'});
                }
                // else if(feed.user_feed.length <= index){
                //     res.status(400).send({success: false, msg: 'Start is out of bounds! Please don\'t try to break me :('});
                // }
                else {
                    let return_array = feed.user_feed;//.slice(index, index + 20);   //grab 20 elements from a specific start
                    let returnJSON = {
                        success: true,
                        msg: 'Successfully retrieved a portion of userfeed',
                        user_feed: return_array
                    };
                    res.status(200).send(returnJSON);
                }
            })
        // }
        // else{
        //     res.status(400).send({success: true, msg: 'Start was not specified, I need some number n to multiply with 20'})
        // }
    })
    .post(authJwtController.isAuthenticated, function (req, res) {
            if(req.body.commits){
                for(let i = 0; i < req.body.commits.length; ++i) {
                    User.findOneAndUpdate({username: req.params.username}, {$addToSet: {user_feed: req.body.commits[i]}}, function(err, doc) {
                        if(err){res.send(err)}
                    });
                }
                //retrieve user_feed and send it back
                User.findOne({username: req.params.username}, 'user_feed', function(err, doc){
                    if(err){
                        res.status(400).send({success: false, msg: 'Error sending back updated userfeed!'});
                    }
                    else {
                        res.status(200).send({success: true, msg: 'userfeed updated', user_feed: doc._doc.user_feed});
                    }
                });

            }
            else{
                //there is no commits to push, mistake has been made
                res.status(400).send({success: false, msg: 'I didn\'t receive any commits to add to the user feed'})
            }
        }
    );

//TODO Refactor, lots of repetitive code, specifically updating fields in user schema for new_commits should be refactored
//Updates a specific value of a user by calling githubs API to fetch the data that needs to be updated
router.route('/update/:github_user/:variable/:repo_name?')
    .get(authJwtController.isAuthenticated, function(req, res) {
        //First thing first, we want to map out which path we have to take,
        // are we updating info about the name/bio/image(profile), or are we updating repo and commits?

        //API call = 1
        if (req.params.variable === "profile" && req.params.github_user) {
            //Find user in DB
            User.findOne({github_username: req.params.github_user}).exec(function (err, user) {
                if (err) {
                    res.send(err);
                }
                //if user exists, aka a match was found
                if (user) {
                    //call API to retrieve profile info (API call = 1)
                    let jsonResult = fetchProfileData(req.params.github_user);
                    //try to update the user
                    try {
                        User.updateOne({github_username: req.params.github_user}, {
                            $set: {
                                name: jsonResult['name_key'],
                                profile_img: jsonResult['img_key'],
                                bio: jsonResult['bio_key']
                            }
                        }).exec(function(err, result){
                            let response = {
                                success: true,
                                msg: 'User profile has been updated!',
                                name: jsonResult['name_key'],
                                profile_img: jsonResult['img_key'],
                                bio: jsonResult['bio_key']
                            };
                            res.status(200).send(response);
                        });
                    } catch (e) {
                        print(e);
                    }
                } else {
                    res.status(400).send({success: false, msg: 'No match for this user'});
                }
            });
        }
        //API call = 1
        else if (req.params.variable === "repo" && req.params.github_user) {
            //call API to retrieve all repos for this user (API call = 1)

            User.findOne({github_username: req.params.github_user}).exec(function (err, user) {
                if (err) {
                    res.send(err);
                }
                //if user exists, aka a match was found
                if (user) {
                    let repo_array = fetchRepoData(req.params.github_user);
                    let repo_info = {
                        repo_names: repo_array,
                        posts: user._doc.repo_info.posts
                    };
                    //try to update the user
                    try {
                        User.updateOne({github_username: req.params.github_user}, {
                            $set: {
                                repo_info: repo_info
                            }
                        }).exec(function(err, result){
                            let response = {
                                success: true,
                                msg: 'User repos has been updated!',
                                repo_names: repo_array
                            };
                            res.status(200).send(response);
                        });
                    } catch (e) {
                        print(e);
                    }
                } else {
                    res.status(400).send({success: false, msg: 'No match for this user'});
                }
            });
        }
        //API call = 1
        else if (req.params.variable === "specificCommit" && req.params.github_user) {
            //call API on that specific repo to fetch all existing commits
            if (!req.params.repo_name) {
                res.status(400).send({
                    success: false,
                    msg: "Please specify the repo name. Example: '/update/TrystanKaes/commit/ShamehubAPI'"
                })
            }
            User.findOne({github_username: req.params.github_user}).exec(function (err, user) {
                if (err) {
                    res.send(err);
                }
                //if user exists, aka a match was found
                if (user) {
                    //call API to retrieve commits of specific repo (API call = 1)

                    //get commit array to pass into function
                    let commit_array = user._doc.repo_info.posts.slice();   //deep copy for immutable change later on
                    let jsonResult = fetchCommitData(req.params.github_user, req.params.repo_name, commit_array);
                    let filtered_newCommits = [];
                    //update our commit history by adding any new commits into posts
                    //!----Dangerous code here, without this if statement, the for loop would break on trying to find the length of null
                    if(jsonResult['new_commits'] != null){
                        for(let i = 0; i < jsonResult['new_commits'].length; ++i){
                            commit_array.push(jsonResult['new_commits'][i]);
                            //new_commits might have commits that aren't related to the user but related to repo, filter it out
                            if(jsonResult['new_commits'][i].login_name === req.params.github_user){
                                filtered_newCommits.push(jsonResult['new_commits'][i]);
                            }
                        }
                    }
                    else{
                        filtered_newCommits = null;
                    }
                    let repo_info = {
                        repo_names: user._doc.repo_info.repo_names,
                        posts: commit_array
                    };
                    //try to update the user repo info
                    try {
                        User.updateOne({github_username: req.params.github_user}, {
                            $set: {
                                new_commits: filtered_newCommits,
                                repo_info: repo_info,
                            }
                        }).exec(function(err, result){
                            let response = {
                                success: true,
                                msg: filtered_newCommits ? 'User commits for ' +req.params.repo_name + ' has been updated!' : 'No new commits detected for this repo',
                                new_commits: filtered_newCommits
                            };
                            res.status(200).send(response);
                        });
                    }
                    catch (e) {
                        res.status(400).send(e);
                    }
                }
                else {
                    res.status(400).send({success: false, msg: 'No match for this user'});
                }
            });
        }
        //API call = n + 1
        else if(req.params.variable === "commits" && req.params.github_user){
            //fetch all repos and all commits from all repos (commits = n, repos = 1)
            User.findOne({github_username: req.params.github_user}).exec(function (err, user) {
                if (err) {
                    res.send(err);
                }
                //if user exists, aka a match was found
                if (user) {
                    //call API to retrieve commits of specific repo (API call = 1)

                    //get commit array to pass into function
                    let commit_array = user._doc.repo_info.posts.slice();   //deep copy for immutable change later on
                    let jsonResult = fetchAllRepoCommitData(req.params.github_user, commit_array);
                    let filtered_newCommits = [];
                    //update our commit history by adding any new commits into posts
                    //!----Dangerous code here, without this if statement, the for loop would break on trying to find the length of null
                    if(jsonResult['new_commits'] != null){
                        for(let i = 0; i < jsonResult['new_commits'].length; ++i){
                            commit_array.push(jsonResult['new_commits'][i]);
                            //new_commits might have commits that aren't related to the user but related to repo, filter it out
                            if(jsonResult['new_commits'][i].login_name === req.params.github_user){
                                filtered_newCommits.push(jsonResult['new_commits'][i]);
                            }
                        }
                    }
                    else{
                        filtered_newCommits = null;
                    }
                    //try to update the user repo info
                    try {
                        User.updateOne({github_username: req.params.github_user}, {
                            $set: {
                                new_commits: filtered_newCommits,
                                repo_info: jsonResult['repo_info'],
                            }
                        }).exec(function(err, result){
                            let response = {
                                success: true,
                                msg: filtered_newCommits ? 'User commits has been updated!' : 'No new commits were detected!',
                                new_commits: filtered_newCommits
                            };
                            res.status(200).send(response);
                        });
                    }
                    catch (e) {
                        res.status(400).send(e);
                    }
                }
                else {
                    res.status(400).send({success: false, msg: 'No match for this user'});
                }
            });
        }
        else {
            res.status(400).send({
                success: false, msg: "Could not understand what to update and/or for who.\n " +
                    "Please specify if it's 'profile', 'repo', 'specificCommit', or 'commits'. Ex: '/update/xFrenchy/profile'"
            })
        }
    })
    .post(authJwtController.isAuthenticated, function(req, res){
        if(req.params.variable === "profile"){
            User.findOne({ github_username: req.params.github_user }, 'name profile_img bio').exec(function(err, user) {
                let name = req.body.name ? req.body.name : user.name;
                let img = req.body.profile_img ? req.body.profile_img : user.profile_img;
                let bio = req.body.bio ? req.body.bio : user.bio;

                //Update user in database
                try {
                    User.updateOne({github_username: req.params.github_user}, {
                        $set: {
                            name: name,
                            profile_img: img,
                            bio: bio
                        }
                    }).exec(function(err, result){
                        if(err){
                            res.status(400).send(err);
                        }
                        let response  = {
                            success: true,
                            msg: 'User profile updated!',
                            name: name,
                            profile_img: img,
                            bio: bio
                        };
                        res.status(200).send(response);
                    });
                } catch (e) {
                    res.status(400).send(e);
                }
            });
        }
        else{
            res.status(400).send({success: false, msg: 'Do not recognize the path for this POST, make sure to specific that it\'s for a profile' +
                    'Example, /update/TrystanKaes/profile' });
        }
    });

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
        var username = req.params.username;
        User.findOne({ username: username }).exec(function(err, user) {
            if (err) res.send(err);
                res.send(user._doc);
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
    if (!req.body.username || !req.body.password || !req.body.github_username) {
        res.json({success: false, message: 'Please pass github username, username, and password.'});
    }
    else {
        var user = new User();
        //retrieve all github information about this specific user
        var jsonInfo = fetchAllUserData(req.body.github_username);
        user.name = jsonInfo['name_key'];
        user.username = req.body.username;
        user.password = req.body.password;
        user.github_username = req.body.github_username;
        user.profile_img = jsonInfo['img_key'];
        user.github_link = "https://github.com/" + req.body.github_username;
        user.bio = jsonInfo['bio_key'];
        user.new_commits = null;
        user.repo_info = jsonInfo['repo_info']
        // user.new_repo_info = null;
        // user.repo_info = jsonInfo['repo_info'];
        // user.fe_repo_info = jsonInfo['fe_repo_info'];
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
                let insult = insults[Math.floor(Math.random()*insults.length)];
                res.status(200).send({msg: "GET insults", insults: insult});
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
