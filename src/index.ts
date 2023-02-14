import EventEmitter from 'node:events';
import express from "express";
import { db } from './structs/database';
import { WebhookPayload, Webhook } from '@top-gg/sdk';

export interface TopggOptions {
	/** The webhook URL path e.g. http://ip:port/<b>PATH</b> 
	 * @defaultValue '/topggwebhook' */
	path?: string;
	/** The webhook URL port e.g. http://ip:<b>PORT</b>/path 
	 * @defaultValue 3000 */
	port?: number;
	/** The sqlite database location 
	 * @defaultValue './voters.db' */
	dbPath?: string;
	/** The number of seconds to wait before firing the remind event
	 * @defaultValue 43200 e.g. 12 hours */
	reminderTime?: number;
	/** The number of seconds between checking the database for reminders.
		 * @defaultValue 10 */
	interval?: number;
	/** The sqlite database location for test votes
	 * @defaultValue ':memory:' :memory: uses a temporary in memory database */
	testDbPath?: string;
	/** The number of seconds to wait before firing the test remind event
	 * @defaultValue 30 e.g. 30 seconds */
	testReminderTime?: number;
	/** Are reminders given by default? 
	 * @defaultValue false */
	remindersOptInDefault?: boolean;
}
interface _TopggOptions {
	path: string;
	port: number;
	dbPath: string;
	reminderTime: number;
	interval: number;
	testDbPath: string;
	testReminderTime: number;
	remindersOptInDefault: boolean;
}

export class VotingSDK extends EventEmitter {
	/** 
	 * The expressjs app
	 * @see [Expressjs](http://expressjs.com/en/4x/api.html#app)
	 * */
	public app: express.Application;
	private options: _TopggOptions;

	/**
 * An event when someone votes
 * @event
 * @example
 * ```js
 * topgg.on("vote", (vote) => {
 * 	console.log(`Vote event: ${JSON.stringify(vote)}`)
 * })
 * ```
 */
	static ON_VOTE = "vote";

	/**
	 * An event when you can remind someone
	 * @event
	 * @example
	 * ```js
	 * topgg.on("reminder", (reminder) => {
	 * 	console.log(`reminder event: ${JSON.stringify(reminder)}`)
	 * })
	 * ```
	 */
	static ON_REMINDER = "reminder";

	/**
* An event when someone uses the "send test" button on Top.gg
* @event
* @example
* ```js
* topgg.on("testVote", (vote) => {
* 	console.log(`Vote event: ${JSON.stringify(vote)}`)
* })
* ```
*/
	static ON_TEST_VOTE = "testVote";

	/**
	 * A reminder event for when someone uses the "send test" button on Top.gg
	 * @event
	 * @example
	 * ```js
	 * topgg.on("testReminder", (reminder) => {
	 * 	console.log(`reminder event: ${JSON.stringify(reminder)}`)
	 * })
	 * ```
	 */
	static ON_TEST_REMINDER = "testReminder";

	private webhook: { listener: (arg0: (vote: WebhookPayload) => void) => any; };
	private _db: db;
	private _interval!: NodeJS.Timer;
	private _testDb: db;
	private authorization: string;

	/**
	 * Create a new vote SDK instance
	 * @param authorization Webhook authorization to verify requests
	*/
	constructor(authorization: string, options: TopggOptions = {}) {
		super();

		this.app = express();
		this.authorization = authorization;

		this.options = {
			path: options.path ?? "/topggwebhook",
			port: options.port ?? 3000,
			dbPath: options.dbPath ?? "./voters.db",
			reminderTime: options.reminderTime ?? 43200,
			interval: options.interval ?? 10000,
			testDbPath: options.testDbPath ?? ':memory:',
			testReminderTime: options.testReminderTime ?? 30,
			remindersOptInDefault: options.remindersOptInDefault ?? false
		};

		this._db = new db(this.options.dbPath, this.options.reminderTime, this.options.remindersOptInDefault);
		this._testDb = new db(this.options.testDbPath, this.options.testReminderTime, this.options.remindersOptInDefault);
		this.webhook = new Webhook(this.authorization);

		this.app.post(this.options.path, this.webhook.listener((vote: WebhookPayload) => {

			if (vote.type === 'test') {
				this.emit('testVote', vote);
				this._testDb.addUser(vote.user);
				return;
			}

			this.emit('vote', vote);
			this._db.addUser(vote.user)
		}))
	}

	/**
	 * Initilize the databases and starts the webhook listener
	*/
	async init() {
		await this._db.init();
		await this._testDb.init();

		this.app.listen(this.options.port);

		this._interval = setInterval(async () => {
			this._db.reminders(
				async (err, row) => {
					if (err) return console.error(err);
					const optedIn = await this._db.getOpt(row.id);
					if (optedIn) this.emit('reminder', row)
					this._db.deleteUser(row.id)
				}
			)
			this._testDb.reminders(
				async (err, row) => {
					if (err) return console.error(err);
					const optedIn = await this._testDb.getOpt(row.id);
					if (optedIn) this.emit('testReminder', row)
					this._testDb.deleteUser(row.id)
				}
			)
		},
			this.options.interval);
	}

	/**
	 * 
	 * @param id a user or member id
	 * @param test if true checks the in test database
	 * 
	 * @returns {Promise<boolean>} if the user voted within the past 12 hours
	 * 
	 * @example 
	 * ```js
	 * 	const voted = await topgg.hasVoted(user.id)
	 * ```
	*/
	async hasVoted(id: string, test: boolean = false): Promise<boolean> {
		if (test) return ((await this._testDb.getUser(id)) != undefined)
		return ((await this._db.getUser(id)) != undefined)
	}

	/**
	 * 
	 * @param id a user or member id
	 * @param test if true checks the in test database
	 * 
	 * @returns {Number} the timestamp the user voted at if they have voted in the past 12 hours or undefined if they havent voted within the past 12 hours.
	 * 
	 * @example
	 * ```js
	 *  const voted = await topgg.votedAt(user.id)
	 * ```
	*/
	async votedAt(id: string, test: boolean = false): Promise<number | undefined> {
		if (test) return (await this._testDb.getUser(id))?.votedAt;
		return (await this._db.getUser(id))?.votedAt;
	}

	/**
	 * Opt the user in for voting reminders
	 * @param id a user or member id
	 * @param test if true checks the in test database
	 * 
	 * @returns {Promise<boolean>} True
	 * 
	 * @example
	 * ```js
	 *  await topgg.optOut(user.id)
	 * ```
	*/
	optIn(id: string, test: boolean = false): Promise<boolean> {
		if (test) return this._testDb.optIn(id)
		return this._db.optIn(id);
	}

	/**
	 * Opt the user out for voting reminders
	 * @param id a user or member id
	 * @param test if true checks the in test database
	 * 
	 * @returns {Promise<boolean>} False
	 * 
	 * @example
	 * ```js
	 *  await topgg.optOut(user.id);
	 * ```
	*/
	optOut(id: string, test: boolean = false): Promise<boolean> {
		if (test) return this._testDb.optOut(id)
		return this._db.optOut(id);
	}

	/**
	 * Set the users Opt in/out status
	 * @param id a user or member id
	 * @param test if true checks the in test database
	 * 
	 * @returns {Promise<boolean>} Boolean for what the users optIn status was set to
	 * 
	 * @example
	 * ```js
	 *  await topgg.setOpt(user.id, true); // the user has now opted into receving reminders
	 * ```
	*/
	setOpt(id: string, value: boolean, test: boolean = false): Promise<boolean> {
		if (test) return this._testDb.setOpt(id, value)
		return this._db.setOpt(id, value);
	}

	/**
	 * Get a boolean for if the user wants reminders or not
	 * @param id a user or member id
	 * @param test if true checks the in test database
	 * 
	 * @returns {Promise<boolean>} Boolean for if the user wants reminders
	 * 
	 * @example
	 * ```js
	 *  const userOptedIn = await topgg.getOpt(user.id);
	 * ```
	*/
	getOpt(id: string, test: boolean = false): Promise<boolean> {
		if (test) return this._testDb.getOpt(id)
		return this._db.getOpt(id);
	}
}