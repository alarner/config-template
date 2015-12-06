/*eslint strict:0 */
'use strict';
let _ = require('lodash');
let term = require( 'terminal-kit' ).terminal;
let keypress = require('keypress');
let spawn = require('child_process').spawn;

const TAB = '    ';

function recurse(obj, counter, path) {
	counter = counter || 1;
	path = path || [];

	let returnObject = {
		lines: [],
		counter: counter
	};
	if(!_.isObject(obj)) {
		returnObject.lines.push({line: counter, path: path, help: obj, value: '', deleted: false});
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

function editor(background, lines, readStream) {
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
		// c.pipe(process.stdout);

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
							term.moveTo(1, state.height+1);
							resolve();
						}
					});
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
				term.left(1);
			}
			else if(key.name === 'right') {
				term.right(1);
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
			term.eraseDisplay();
			renderHeader();
			renderBody();
			renderFooter();
			term.moveTo(state.cursor.x, state.cursor.y);
		}

		function renderHeader() {
			term.moveTo(1, state.headerHeight);
			term.eraseDisplayAbove();
			term.moveTo(1, state.headerHeight);
			term('-'.repeat(state.width));
			term.moveTo(1, 1);
			term('dimensions: '+state.width + 'x' + state.height+' ');
			term('cursor: '+state.cursor.x + ',' + state.cursor.y+' ');
			term(state.top.toString()+' '+(state.height - state.headerHeight).toString());
		}

		function renderFooter() {
			term.moveTo(1, state.height - state.footerHeight + 1);
			term.eraseDisplayBelow();
			term('-'.repeat(state.width));
			term.moveTo(1, state.height - state.footerHeight + 2);
			term('Description: '+lines[state.currentLineIndex].help);
		}

		function renderBody() {
			let endLine = state.height+state.top-state.footerHeight-state.headerHeight;
			term.moveTo(1, state.headerHeight+1);
			term(
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
				term.moveTo(x, y);
				if(line.value) {
					term(line.value);
				}
				else {
					term.colorRgb(50, 50, 50, '______');
					term(',');
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

	editor(background, result.lines, process.stdin);
};