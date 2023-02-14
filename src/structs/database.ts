import { error } from 'node:console';
import sqlite3 from 'sqlite3';

export class db {
	public _sqlite!: sqlite3.Database;
	ready: boolean;
	private remindAt: string;
	optInByDefault: boolean;
	path: string;
	constructor(path: string, remindAt: number, optInByDefault: boolean) {
		this.remindAt = remindAt.toString();
		this.optInByDefault = optInByDefault;
		this.ready = false;
		this.path = path;
	}

	init(): Promise<any> {
		let promises = [];
		promises.push(new Promise((resolve, reject) => {
			this._sqlite = new sqlite3.Database(this.path, (err) => {
				if (err) {
					console.error(err.message);
					reject(err)
				}
				resolve(null)
			})
		}))

		promises.push(new Promise((resolve, reject) => {
			this._sqlite.run(`
				CREATE TABLE IF NOT EXISTS voters (
					id VARCHAR NOT NULL PRIMARY KEY,
					votedAt timestamp
				);
		`, (err: Error) => {
				if (err) reject(err)
				resolve(null)
			});
		})
		)
		promises.push(new Promise((resolve, reject) => {
			this._sqlite.run(`
				CREATE TABLE IF NOT EXISTS voterOptions (
					id VARCHAR NOT NULL PRIMARY KEY,
					optIn boolean
				);
			`, (err: Error) => {
				if (err) reject(err)
				resolve(null)
			});
		}))

		return Promise.all(promises).then(() => this.ready = true);
	}

	addUser(id: string): void {
		if (!this.ready) throw new Error('database isnt initilized')
		this._sqlite.run(`
		INSERT into voters 
		(id, votedAt)
		VALUES (?, ?)
		ON CONFLICT (id) DO UPDATE
		SET votedAt = ?2;
		`,
			[
				id,
				new Date()
			])
	}

	deleteUser(id: string): void {
		if (!this.ready) throw new Error('database isnt initilized')
		this._sqlite.run(`
		DELETE FROM voters
		WHERE id = ?
		`, [id])
	}

	getUser(id: string): Promise<row> {
		if (!this.ready) throw new Error('database isnt initilized')
		return new Promise((resolve, reject) => {
			this._sqlite.get('SELECT * FROM voters WHERE id = ?', id, (err: Error, row: row) => {
				if (err) reject(err);
				resolve(row)
			})
		})
	}

	reminders(callback: (err: Error, row: row) => void) {
		if (!this.ready) throw new Error('database isnt initilized')
		this._sqlite.each(`
		SELECT *
		FROM voters
		WHERE votedAt <= unixepoch(datetime('now', '-${this.remindAt} seconds')) * 1000;
		`, callback)
	}

	optIn(id: string): Promise<boolean> {
		if (!this.ready) throw new Error('database isnt initilized')
		return new Promise((resolve, reject) => {
			this._sqlite.get(`
				INSERT INTO voterOptions
				(id, optIn)
				VALUES (?, true)
				ON CONFLICT (id) DO UPDATE
				SET optIn = true;
			`, id,
				(err: Error, row: optRow) => {
					if (err) reject(err);
					resolve(true)
				})
		})
	}

	optOut(id: string): Promise<boolean> {
		if (!this.ready) throw new Error('database isnt initilized')
		return new Promise((resolve, reject) => {
			this._sqlite.get(`
			INSERT INTO voterOptions
			(id, optIn)
			VALUES (?, false)
			ON CONFLICT (id) DO UPDATE
			SET optIn = false;
			`, id,
				(err: Error, row: optRow) => {
					if (err) reject(err);
					resolve(false)
				})
		})
	}

	setOpt(id: string, value: boolean = false): Promise<boolean> {
		if (!this.ready) throw new Error('database isnt initilized')
		return new Promise((resolve, reject) => {
			this._sqlite.get(`
				INSERT INTO voterOptions
				(id, optIn)
				VALUES (?, ?)
				ON CONFLICT (id) DO UPDATE
				SET optIn = ?2;
			`, [value, id],
				(err: Error, row: optRow) => {
					if (err) reject(err);
					resolve(value)
				})
		})
	}

	getOpt(id: string): Promise<boolean> {
		if (!this.ready) throw new Error('database isnt initilized')
		return new Promise((resolve, reject) => {
			this._sqlite.get('SELECT * FROM voterOptions WHERE id = ?', id, (err: Error, row: optRow) => {
				if (err) reject(err);
				resolve(Boolean(row?.optIn ?? this.optInByDefault))
			})
		})

	}
}

interface row {
	id: string
	votedAt: number
}

interface optRow {
	id: string
	optIn: boolean
}