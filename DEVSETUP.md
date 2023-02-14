## Developer install & testing
Testing an npm library should use `npm link` to 'fake' a library and allow testing.
1. run in your terminal `git clone https://github.com/Topgg-Volunteer-Staff/topgg-voting-node-sdk voting-sdk` & `cd voting-sdk`
2. run `npm link` & `npm i`
3. create a new project anywhere on your computer.
4. run `npm init -y`
5. open the new projects package.json and add the @top-gg/voting-sdk dependancy manually(no npm project exists yet, so `npm i @top-gg/voting-sdk` will not work)
```json
  "dependencies": {
    "@top-gg/voting-sdk": "0.1.1"
  },
```
6. run `npm link @top-gg/voting-sdk` in the new projects folder

### You can now use the library
