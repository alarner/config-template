/*eslint strict:0 */
'use strict';
let _ = require('lodash');
let term = require('terminal-kit').terminal;
let keypress = require('keypress');
let spawn = require('child_process').spawn;
let validator = require('validator');

const TAB = '    ';
const helpRegex = /^\[(string|number|boolean|json)\].*$/i;

function appendExtraData(tmpl, extra) {
	var returnObject = {};
	if (!extra) extra = {};
	for (let key in tmpl) {
		if (tmpl.hasOwnProperty(key)) {
			if (_.isObject(tmpl[key])) {
				returnObject[key] = appendExtraData(tmpl[key], extra[key]);
			} else {
				returnObject[key] = tmpl[key];
			}
		}
	}
	for (let key in extra) {
		if (extra.hasOwnProperty(key)) {
			if (_.isObject(extra[key])) {
				if (!tmpl[key]) tmpl[key] = {};
				if (!tmpl[key].toString().match(/^\[json\].*/))
					returnObject[key] = appendExtraData(tmpl[key], extra[key]);
			} else {
				if (!tmpl.hasOwnProperty(key)) returnObject[key] = extra[key];
			}
		}
	}
	return returnObject;
}

function setDefaultValues(parsedTmpl, values) {
	for (var line,i=0; line=parsedTmpl.lines[i]; i++) {
		var obj = values;
		for (var k,j=0; k=line.path[j]; j++) obj = obj[k] || '';
		line.value = obj.toString();
	}
}

function interpretTmpl(obj, counter, path) {
	counter = counter || 1;
	path = path || [];

	let value = '';

	let returnObject = {
		lines: [],
		counter: counter
	};

	if(!_.isObject(obj)) {
		let match = null;
		let type = 'string';
		
		if(!_.isString(obj) || !obj.match(helpRegex)) {
			value = obj.toString();
			if (_.isString(obj))  obj = '[string] Defaults to "'+obj.toString()+'"';
			if (_.isNumber(obj))  obj = '[number] Defaults to ' +obj.toString();
			if (_.isBoolean(obj)) obj = '[boolean] Defaults to '+obj.toString();
		}

		if(match = obj.match(helpRegex)) {
			type = match[1];
		}
		else {
			obj = '[string] '+obj;
		}

		returnObject.lines.push({
			line: counter,
			path: path,
			help: obj,
			value: value,
			deleted: false,
			empty: false,
			type: type.toLowerCase()
		});
		returnObject.counter++;
	}
	else {
		for(let key in obj) {
			if(obj.hasOwnProperty(key)) {
				let newPath = _.clone(path);
				newPath.push(key);
				let result = interpretTmpl(obj[key], returnObject.counter, newPath);
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
			result.push(TAB.repeat(fromPath.length)+'},');
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
		result.push('},');
	}

	return result;
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
		currentLineIndex: 0,
		error: ''
	};
	return new Promise((resolve, reject) => {
		keypress(process.stdin);
		// c.pipe(process.stdout);

		readStream.resume();
		readStream.setEncoding('utf8');
		readStream.setRawMode(true);
		state.width = process.stdout.columns;
		state.height = process.stdout.rows;

		readStream.on('keypress', onKeyPress);
		goToLine(state.currentLineIndex);

		setTimeout(render, 200);

		function onKeyPress(text, key) {
			// {"name":"c","ctrl":true,"meta":false,"shift":false,"sequence":"\u0003"}
			let charCode = text ? text.charCodeAt(0) : null;
			let line = lines[state.currentLineIndex];
			if(key && key.ctrl) {
				if(key.name === 'c') {
					exit((err, result) => {
						if(result) {
							reject('Edit session canceled by user.');
						}
					});
				}
				if(key.name === 's') {
					exit((err, result) => {
						if(result) {
							resolve(buildObject());
						}
					});
				}
				else if(key.name === 'e' && line.type === 'string') {
					line.empty = true;
					line.deleted = false;
					line.value = '';
					state.cursor.x = background[line.backgroundLineNum].length + 2;
					render();
				}
				else if(key.name === 'r') {
					line.deleted = true;
					line.empty = false;
					line.value = '';
					state.cursor.x = background[line.backgroundLineNum].length + 1;
					render();
				}
			}
			else if(key && key.name === 'return') {
				goToLine(state.currentLineIndex+1);
			}
			else if(key && key.name === 'down') {
				goToLine(state.currentLineIndex+1);
			}
			else if(key && key.name === 'up') {
				goToLine(state.currentLineIndex-1);
			}
			else if(key && key.name === 'left') {
				let offset = line.type === 'string' && !line.deleted ? 1 : 0;
				if(state.cursor.x-1 > background[line.backgroundLineNum].length + offset) {
					state.cursor.x--;
					render();
				}
			}
			else if(key && key.name === 'right') {
				let offset = line.type === 'string' && !line.deleted ? 1 : 0;
				if(state.cursor.x+1 <= background[line.backgroundLineNum].length + line.value.length + offset + 1) {
					state.cursor.x++;
					render();
				}
			}
			else if(key && key.name === 'backspace') {
				let offset = line.type === 'string' && !line.deleted ? 1 : 0;
				if(state.cursor.x-1 > background[line.backgroundLineNum].length + offset) {
					del();
				}
				
			}
			else if(charCode >= 32 && charCode <= 126) {
				insert(text);
			}
		}

		function splice(text, idx, rem, str) {
			return text.slice(0, idx) + str + text.slice(idx + Math.abs(rem));
		};

		function insert(char) {
			let line = lines[state.currentLineIndex];
			let pos = state.cursor.x - background[line.backgroundLineNum].length;
			state.cursor.x++;

			// Deal with quotation marks
			if(line.type === 'string' && !line.empty) {
				pos--;
				if(!line.value){
					state.cursor.x++;
				}
			}
			line.deleted = false;
			line.empty = false;
			line.value = splice(line.value, pos-1, 0, char);
			render();
		}

		function del() {
			let line = lines[state.currentLineIndex];
			let pos = state.cursor.x - background[line.backgroundLineNum].length - 2;
			state.cursor.x--;

			// Deal with quotation marks
			if(line.value && line.type === 'string' && !line.empty) {
				pos -= 1;
			}
			
			line.value = splice(line.value, pos, 1, '');

			// Deal with removing marks
			if(!line.value && line.type === 'string' && !line.empty) {
				state.cursor.x--;
			}

			render();
		}

		function checkError(line) {
			if(!line.value) {
				return '';
			}
			switch(line.type) {
				case 'number':
					return validator.isDecimal(line.value) ? '' : 'Invalid number';
				case 'boolean':
					line.value = line.value.toLowerCase();
					return validator.isIn(line.value, ['true', 'false']) ? '' : 'Invalid boolean';
				case 'json':
					return validator.isJSON(line.value) ? '' : 'Invalid JSON. Use double quotes on keys and values.';
			}
			return '';
		}

		function goToLine(num) {
			// Validate data
			let line = lines[state.currentLineIndex];
			state.error = checkError(line);
			if(state.error) {
				return render();
			}

			// Move line
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
				state.top = Math.max(0, background.length - state.height + state.headerHeight + state.footerHeight);
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

		function buildObject() {
			let obj = {};
			term.eraseDisplay();

			lines.forEach((line) => {
				if(line.deleted) {
					return;
				}
				let target = obj;
				for(let i=0; i<line.path.length-1; i++) {
					if(!target.hasOwnProperty(line.path[i])) {
						let newTarget = {};
						target[line.path[i]] = newTarget;
					}
					target = target[line.path[i]];
				}
				target[line.path[line.path.length-1]] = getLineValue(line);
			});

			return obj;
		}

		function getLineValue(line) {
			switch(line.type) {
				case 'string':
					return line.value;
				case 'number':
					return parseFloat(line.value);
				case 'boolean':
					return (line.value === 'true');
				case 'json':
					return JSON.parse(line.value);
			}
			return null;
		}

		function exit(cb) {
			readStream.removeListener('keypress', onKeyPress);
			readStream.pause();
			readStream.setRawMode(false);
			term.moveTo(1, state.height+1);
			console.log('');
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
			term('DONE: ctrl + s | CANCEL: ctrl + c | SET EMPTY: ctrl + e | REMOVE: ctrl + r');
			// term('dimensions: '+state.width + 'x' + state.height+' ');
			// term('cursor: '+state.cursor.x + ',' + state.cursor.y+' ');
			// term(state.top.toString()+' '+(state.height - state.headerHeight).toString());
		}

		function renderFooter() {
			term.moveTo(1, state.height - state.footerHeight + 1);
			term.eraseDisplayBelow();
			term('-'.repeat(state.width));
			term.moveTo(1, state.height - state.footerHeight + 2);
			if(state.error) {
				term.brightRed(state.error);
			}
			else {
				term('Description: '+lines[state.currentLineIndex].help);
			}
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
					switch(line.type) {
						case 'string':
							term.yellow('"'+line.value+'"');
						break;
						case 'number':
							term.cyan(line.value);
						break;
						case 'boolean':
							term.magenta(line.value);
						break;
						case 'json':
							term.colorRgb(150, 200, 255, line.value);
						break;
						default:
							term(line.value);
						break;
					}
					
				}
				else if(line.empty) {
					term.yellow('""');
				}
				else if(line.deleted) {
					term.italic.colorRgb(50, 50, 50, '- removed -');
				}
				else {
					term.colorRgb(50, 50, 50, '______');
				}
				term(',');
			});
		}
	});
	
}

module.exports = function(configTemplate, options) {
	if (!options) options = {};
	if (!options.inputSource) options.inputSource = process.stdin;
	if (!options.values) options.values = {};
	if (options.appendExtraData==null) options.appendExtraData = true;
	if (options.appendExtraData) {
		configTemplate = appendExtraData(configTemplate, options.values);
	}
	let parsedTmpl = interpretTmpl(configTemplate);
	setDefaultValues(parsedTmpl, options.values);
	let prev = {};
	let background = [];

	parsedTmpl.lines.forEach((line) => {
		background = background
			.concat(getFiller(prev.path || [], line.path))
			.concat(getLine(line));
		line.backgroundLineNum = background.length-1;
		prev = line;
	});
	background = background
			.concat(getFiller(prev.path, []));
	background[background.length-1] = background[background.length-1].substr(0, background[background.length-1].length-1);

	return editor(background, parsedTmpl.lines, options.inputSource);
};

module.exports.interpretTmpl = interpretTmpl;
module.exports.appendExtraData = appendExtraData;
module.exports.setDefaultValues = setDefaultValues;
