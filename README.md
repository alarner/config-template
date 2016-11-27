# config-template
Create server specific configuration files from a template via the command line.

![image](/out.gif)

### Install

`npm install --save config-template`

### Use case

* Deploying your app to a new server via an automated script
* Installing your app on your dev machine for the first time
* Using a task runner (eg. gulp) to check if the config file exists and if not, prompting the user to create it before booting up the app.

Imagine you have a configuration file on your dev machine that looks like this:

`config.js`

```js
module.exports = {
	environment: 'development',
	port: 3000,
	devMode: true,
	database: {
		connection: {
			user: 'alarner',
			password: 'not a real password',
			database: 'test'
		}
	}
};
```

Whenever you want to deploy this app or set up a new dev, test or staging instance you'll want to tweak those values and set up a new config file. You'll also want to document all of the settings that are available and describe what they do. For example your config.template.js file might look like this:

`config.template.js`

```js
module.exports = {
	environment: '[string] The environment to run under.',
	port: '[number] The web server port.',
	debug: '[boolean] Show debug messages or not.',
	database: {
		connection: {
			user: '[string] Database user.',
			password: '[string] Database password.',
			database: '[string] Database name.'
		}
	}
};
```

Config loader can read a template file like the one above and provide a command line interface for creating that config file for the first time.

```js
var configTemplate = require('config-template');
var tpl = require('./config.template.js');

configTemplate(tpl).then(function(config) {
	console.log(JSON.stringify(config));
})

/*

{
	environment: 'development',
	port: 3000,
	devMode: true,
	database: {
		connection: {
			user: 'alarner',
			password: 'not a real password',
			database: 'test'
		}
	}
}

*/
```

![image](/out.gif)

## Supported data types

* string
* number
* boolean
* json

## Options

An options object can be passed as the second argument to config loader. Config loader understand 
the following options...

* inputSource - defaults to stdin. Mostly used for testing, but you can supply a different input source if you choose.
* values - defaults to an empty object. This option allows you to specify any values that you'd like to be pre-filled in.
* appendExtraData - defaults to true. If this is set to true and options.values has properties that don'e match up with one of your template properties, config loader will automatically add that property to the template. If it is set to false then extraneous properties in options.values will be ignored.

## Features

* Displays your customized description (from your template) of the config property when that property is selected.
* Basic data validation
* Ability to ignore / remove properties from the config object
* Set empty strings
* Color coding

## Todo

* horizontal scrolling