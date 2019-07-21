GithubStatTool
===

The Github Stat Tools allows you to get commit, line, and language statistics across your entire Github account. It does this using headless chrome to scan your commit history.

#Safety:
The tool requires your github password is stored in `cred.json` take care not to share this file with anyone. In addition, the tool will store your github session (only a little less powerful than your password) in `working/cookies.json`. It is recommended that you delete `working/cookies.json` and remove your password from `cred.json` when you finish working with the tool to protect your GitHub account security. By default, `working/cookies.json` will be deleted for you, however it is always best to check.

##Usage:
Running is simple, copy cred.sample.json to cred.json, enter the real username and password for your GitHub account, then ```npm install``` and use ```npm start``` to compile and run the tool.

##Resume Task:
The tool is designed to allow you to start and stop the task at any time. The results of each "stage" of the task are stored in `working` so the tool can restart. To restart the tool at an exact stage, use ```npm start -- --<stage name>```. This will pull in the results of the scrape thus far so the task can be resumed.