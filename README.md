# Shamehub

### Synopsis
Shamehub is a social media platform centered around github commit history and activity. It will be a frontend to backend source of shame. In addition to a standard login, passwords are determined by clicking specific pixels on an RGB color wheel. Each failed login attempt will generate a new insult pulled from MongoDB. Users will be able to create accounts and link them to their github. Each activity change or commit will be treated as a status update. Users will be able to add friends giving them the ability to like, dislike, and comment on each status. For each user there will be an overarching “shame timeline”. The Shame Timeline will analyze the users github activity feed and post an appropriate quote summarizing their work. The API’s that will be used are the Github API and the GoodReads API. 

#postman test for creating new insults (and signin and signup, though we don't need authentication right now to post and get insults).
# [![Run in Postman](https://run.pstmn.io/button.svg)](https://app.getpostman.com/run-collection/be2ed5214088a94942c3)