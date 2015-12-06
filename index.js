/*eslint strict:0 */
'use strict';
let _ = require('lodash');
let async = require('async');
let charm = require('charm');
let keypress = require('keypress');
let spawn = require('child_process').spawn;
let chalk = require('chalk');

const TAB = '    ';

function recurse(obj, counter, path) {
	counter = counter || 1;
	path = path || [];

	let returnObject = {
		lines: [],
		counter: counter
	};
	if(!_.isObject(obj)) {
		returnObject.lines.push({line: counter, path: path, help: obj, value: ''});
		returnObject.counter++;
	}
	else {
		for(let key in obj) {
			if(obj.hasOwnProperty(key)) {
				let newPath = _.clone(path);
				newPath.push(key);
				let result = recurse(obj[key], returnObject.counter, newPath);
				returnObject.counter = result.counter;
				returnObject.lines = returnObject.lines.concat(result.lines);
			}
		}
	}
	return returnObject;
}

function getLine(line) {
	return (TAB.repeat(line.path.length)+line.path[line.path.length-1]+': ');
}

function getFiller(fromPath, toPath) {
	let result = [];
	fromPath = _.clone(fromPath);
	toPath = _.clone(toPath);

	if(fromPath.length) {
		fromPath.pop();
	
		while(!_.isEqual(fromPath, toPath.slice(0, fromPath.length))) {
			result.push(TAB.repeat(fromPath.length)+'}');
			fromPath.pop();
		}
	}
	else {
		result.push('{');
	}

	for(let i=fromPath.length; i<toPath.length-1; i++) {
		result.push(TAB.repeat(i+1)+toPath[i]+': {');
	}

	if(!toPath.length) {
		result.push('}');
	}

	return result;
}

function getTermSize(cb){
    spawn('resize').stdout.on('data', function(data){
        data = String(data);
        let lines = data.split('\n');
        let cols = Number(lines[0].match(/^COLUMNS=([0-9]+);$/)[1]);
        let rows = Number(lines[1].match(/^LINES=([0-9]+);$/)[1]);
        if (cb) {
            cb(cols, rows);
        }
    });
}

// function getLineValue(lineString, readStream, charm, cb) {

// 	let result = '';
// 	readStream.resume();
// 	readStream.setEncoding('utf8');
// 	readStream.setRawMode('true');
// 	// readStream.on('data', onReadLine);
// 	readStream.on('keypress', onKeypress);

// 	charm.write(lineString);

// 	function onReadLine(text, key) {
// 		console.log(text.toString());
// 		// console.log(text);
// 		// let charCode = text.charCodeAt(0);
// 		// if(charCode === 27) {
// 		// 	result = false;
// 		// }
// 		// if(charCode === 13 || charCode === 27) {
// 		// 	readStream.removeListener('data', onReadLine);
// 		// 	readStream.removeListener('keypress', onKeypress);
// 		// 	readStream.pause();
// 		// 	cb(null, result);
// 		// }
// 		// else if(charCode >= 32 && charCode <= 126) {
// 		// 	result += text;
// 		// 	// process.stdout.write(text);
// 		// }
// 	}

// 	function onKeypress(text, key) {
// 		let charCode = text.charCodeAt(0);
// 		if(charCode === 27) {
// 			result = false;
// 		}
// 		if(charCode === 13 || charCode === 27) {
// 			// readStream.removeListener('data', onReadLine);
// 			readStream.removeListener('keypress', onKeypress);
// 			readStream.pause();
// 			process.stdout.write('\n');
// 			cb(null, result);
// 		}
// 		else if(key && key.name === 'backspace') {
// 			// charm.write(text);
// 			charm.position((x, y) => {
// 				console.log(x, y);
// 				charm.left(1);
// 				charm.erase('end');
// 			});
// 			// 
// 			// charm.delete('char', 1);
// 		}
// 		else if(charCode >= 32 && charCode <= 126) {
// 			result += text;
// 			process.stdout.write(text);
// 		}
// 	}
// }

function editor(background, lines, readStream) {
	let c = charm();
	let state = {
		width: null,
		height: null,
		cursor: {
			x: 0,
			y: 0
		},
		top: 0,
		headerHeight: 2,
		footerHeight: 2,
		currentLineIndex: 0
	};
	return new Promise((resolve, reject) => {
		keypress(process.stdin);
		c.pipe(process.stdout);

		readStream.resume();
		readStream.setEncoding('utf8');
		readStream.setRawMode('true');

		getTermSize((w, h) => {
			state.width = w;
			state.height = h;
			readStream.on('keypress', onKeyPress);
			goToLine(state.currentLineIndex);
		});

		function onKeyPress(text, key) {
			// {"name":"c","ctrl":true,"meta":false,"shift":false,"sequence":"\u0003"}
			let charCode = text ? text.charCodeAt(0) : null;
			if(key.ctrl) {
				if(key.name === 'c') {
					exit((err, result) => {
						if(result) {
							readStream.removeListener('keypress', onKeyPress);
							readStream.pause();
							resolve();
						}
					});
				}
				else if(key.name === 'r') {
					render();
				}
			}
			else if(key.name === 'return') {
				goToLine(state.currentLineIndex+1);
			}
			else if(key.name === 'down') {
				goToLine(state.currentLineIndex+1);
			}
			else if(key.name === 'up') {
				goToLine(state.currentLineIndex-1);
			}
			else if(key.name === 'left') {
				c.left(1);
			}
			else if(key.name === 'right') {
				c.right(1);
			}
			else if(charCode >= 32 && charCode <= 126) {
				process.stdout.write(text);
			}
		}

		function goToLine(num) {
			let updatedNum = num;
			if(num < 0) {
				state.top = 0;
				updatedNum = 0;
			}
			else if(num >= lines.length) {
				updatedNum = state.currentLineIndex = lines.length-1;
			}
			let x = background[lines[updatedNum].backgroundLineNum].length + lines[updatedNum].value.length + 1;
			let y = lines[updatedNum].backgroundLineNum + state.headerHeight - state.top + 1;
			
			if(y < state.top - 1) {
				state.top += y - state.top + 1;
			}
			else if(num >= lines.length) {
				state.top = background.length - state.height + state.headerHeight + state.footerHeight;
				// state.top = background.length - state.height - state.headerHeight - state.footerHeight;
			}
			else if(y > state.height - state.headerHeight) {
				state.top += y - state.height + state.headerHeight;
			}

			y = lines[updatedNum].backgroundLineNum + state.headerHeight - state.top + 1;

			state.cursor.x = x;
			state.cursor.y = y;
			state.currentLineIndex = updatedNum;

			render();
		}

		function exit(cb) {
			cb(null, true);
		}

		function render() {
			c.reset();
			renderHeader();
			renderBody();
			renderFooter();
			c.position(state.cursor.x, state.cursor.y);
		}

		function renderHeader() {
			c.position(1, state.headerHeight);
			c.erase('up');
			c.position(1, state.headerHeight);
			c.write('-'.repeat(state.width));
			c.position(1, 1);
			c.write('dimensions: '+state.width + 'x' + state.height+' ');
			c.write('cursor: '+state.cursor.x + ',' + state.cursor.y+' ');
			c.write(state.top.toString()+' '+(state.height - state.headerHeight).toString());
		}

		function renderFooter() {
			c.position(1, state.height - state.footerHeight + 1);
			c.erase('down');
			c.write('-'.repeat(state.width));
			c.position(1, state.height - state.footerHeight + 2);
			c.write('Description: '+lines[state.currentLineIndex].help);
		}

		function renderBody() {
			let endLine = state.height+state.top-state.footerHeight-state.headerHeight;
			c.position(1, state.headerHeight+1);
			c.write(
				background.slice(
					state.top,
					endLine
				).join('\n')
			);

			lines.forEach((line) => {
				if(line.backgroundLineNum < state.top || line.backgroundLineNum >= endLine) {
					return;
				}
				let y = line.backgroundLineNum - state.top + state.headerHeight + 1;
				let x = background[line.backgroundLineNum].length + 1;
				c.position(x, y);
				if(line.value) {
					charm.foreground('green');
					c.write(line.value);
					charm.foreground('white');
				}
				else {
					c.write(chalk.dim('______,'));
				}
			});
		}
	});
	
}

module.exports = function(configTemplate) {
	let result = recurse(configTemplate);
	let prev = {};
	let background = [];

	result.lines.forEach((line) => {
		background = background
			.concat(getFiller(prev.path || [], line.path))
			.concat(getLine(line));
		line.backgroundLineNum = background.length-1;
		prev = line;
	});
	background = background
			.concat(getFiller(prev.path, []));

	console.log(background);
	editor(background, result.lines, process.stdin);

	// async.eachSeries(
	// 	result.lines,
	// 	function(line, cb) {
	// 		displayFiller(prev.path || [], line.path);
	// 		let lineString = getLine(process.stdout, line);
	// 		getLineValue(lineString, process.stdin, c, (err, value) => {
	// 			line.value = value;
	// 			cb();
	// 		});
	// 		prev = line;
	// 	},
	// 	function(err, results) {
	// 		displayFiller(prev.path, []);
	// 		console.log(result.lines);
	// 	}
	// );
};