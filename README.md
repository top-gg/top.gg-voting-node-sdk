# Top.gg-Voting-SDK

The offical vote SDK for Top.gg

# Installation
1. Ensure that you're telling your package manager to use the GitHub Package Registry for `@top-gg` packages by putting this in your `.npmrc` file: `@top-gg:registry=https://npm.pkg.github.com`
2. `npm i @top-gg/voting-sdk`


## Example receiving webhooks

```javascript
const { VotingSDK } = require('@top-gg/voting-sdk');

const topgg = new VotingSDK("authorization", {
	testReminderTime: 5, // test vote remidners will be sent after 5 seconds
	port: 3000, 
  	remindersOptInDefault: true // reminders enabled for users by default
})

topgg.on("vote", (vote) => { // fires when someone votes
	console.log(`Vote event: ${JSON.stringify(vote)}`)
})
topgg.on("reminder", (reminder) => { // fires when someone should be reminded
	console.log(`reminder event: ${JSON.stringify(reminder)}`)
})
topgg.on("testVote", (vote) => {
	console.log(`test vote event: ${JSON.stringify(vote)}`)
})
topgg.on("testReminder", (reminder) => {
	console.log(`test reminder event: ${JSON.stringify(reminder)}`)
})
```

------------

# Getting vote information

```javascript
	const userVoted = await topgg.hasVoted(user.id)
	console.log(userVoted) // true or false
```

```javascript
	const userVotedAt = topgg.votedAt(user.id)
	console.log(userVotedAt) // when the user voted at
```

# Setting a users opt-in status for reminders

```javascript
	await topgg.setOpt(user.id, true); // opt in a user
	await topgg.setOpt(user.id, false); // opt out a user
```
