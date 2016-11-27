const should = require('chai').should();
const expect = require('chai').expect;
const helper = require('./helper');
const configTemplate = require('..');

describe('Template Editor', function(){

	it('edits from template', function(done){
		var fakeSTDIN = new helper.FakeSTDIN();
		configTemplate({ // Template
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
		}, { // Options
			inputSource: fakeSTDIN
		}).then(function(config) {
			config.should.be.deep.equal({
				environment: 'Testing',
				port: 123,
				debug: true,
				database: {
					connection: {
						user: 'someone',
						password: 'mysecret',
						database: 'that-database'
					}
				}
			});
			done();
		}).catch(done);
		// Simulate use input:
		fakeSTDIN.write('Testing');
		fakeSTDIN.keypress({name:'down'});
		fakeSTDIN.write('123');
		fakeSTDIN.keypress({name:'down'});
		fakeSTDIN.write('true');
		fakeSTDIN.keypress({name:'down'});
		fakeSTDIN.write('someone');
		fakeSTDIN.keypress({name:'down'});
		fakeSTDIN.write('mysecret');
		fakeSTDIN.keypress({name:'down'});
		fakeSTDIN.write('that-database');
		fakeSTDIN.keypress({name:'s', ctrl:true});
	});

	it('edits from template with default values', function(done){
		var fakeSTDIN = new helper.FakeSTDIN();
		configTemplate({ // Template
			aa: '[string] Some text.',
			bb: '[number] Some number.',
			cc: '[string] Other Text.',
		}, { // Options
			inputSource: fakeSTDIN,
			values: {
				aa: 'Banana',
				bb: '12',
				cc: 'Dog'
			}
		}).then(function(config) {
			config.should.be.deep.equal({
				aa: 'Banana and Cucumber',
				bb: 1234,
				cc: 'Cat'
			});
			done();
		}).catch(done);
		// Simulate use input:
		fakeSTDIN.keypress({name:'right'});
		fakeSTDIN.write(' and Cucumber');
		fakeSTDIN.keypress({name:'down'});
		fakeSTDIN.write('34');
		fakeSTDIN.keypress({name:'down'});
		fakeSTDIN.keypress({name:'right'});
		fakeSTDIN.keypress({name:'backspace'});
		fakeSTDIN.keypress({name:'backspace'});
		fakeSTDIN.keypress({name:'backspace'});
		fakeSTDIN.write('Cat');
		fakeSTDIN.keypress({name:'s', ctrl:true});
	});

	it('appends extra data from values by default', function(done){
		var fakeSTDIN = new helper.FakeSTDIN();
		configTemplate({ // Template
			aa: '[string] Some text.'
		}, { // Options
			inputSource: fakeSTDIN,
			values: {
				aa: 'Banana',
				bb: 12345
			}
		}).then(function(config) {
			config.should.be.deep.equal({
				aa: 'Banana',
				bb: 12345
			});
			done();
		}).catch(done);
		// Simulate use input:
		fakeSTDIN.keypress({name:'s', ctrl:true});
	});

	it('does not append extra data if appendExtraData==false', function(done){
		var fakeSTDIN = new helper.FakeSTDIN();
		configTemplate({ // Template
			aa: '[string] Some text.'
		}, { // Options
			inputSource: fakeSTDIN,
			appendExtraData: false,
			values: {
				aa: 'Banana',
				bb: 12345
			}
		}).then(function(config) {
			config.should.be.deep.equal({
				aa: 'Banana'
			});
			done();
		}).catch(done);
		// Simulate use input:
		fakeSTDIN.keypress({name:'s', ctrl:true});
	});

});

describe('Editor Helpers', function(){

	describe('buildTemplateStringFromValue', function() {
		it('should work with strings', function() {
			expect(configTemplate.buildTemplateStringFromValue('this is a test'))
				.to.equal('[string] Defaults to "this is a test"');
		});
		it('should work with numbers', function() {
			expect(configTemplate.buildTemplateStringFromValue(7))
				.to.equal('[number] Defaults to 7');
		});
		it('should work with booleans', function() {
			expect(configTemplate.buildTemplateStringFromValue(true))
				.to.equal('[boolean] Defaults to true');
		});
		it('should work with objects', function() {
			expect(configTemplate.buildTemplateStringFromValue({foo: 'bar'}))
				.to.equal('[json] Defaults to {"foo":\"bar\"}');
		});
	});

	describe('appendExtraData', function(){

		it ('add data fields to tmpl', function(){
			const tmpl = configTemplate.appendExtraData({
				env: '[string] The environment.',
				port: '[number] to open',
				db: {
					user: '[string] DB user.'
				}
			}, {
				env: 'Testing',
				debug: true,
				db: {
					user: 'someone',
					host: 'example.com'
				}
			});
			expect(tmpl).to.be.deep.equal({
				env: '[string] The environment.',
				port: '[number] to open',
				debug: '[boolean] Defaults to true',
				db: {
					user: '[string] DB user.',
					host: '[string] Defaults to "example.com"'
				}
			});
		});

		it ('add nestled data fields to tmpl', function(){
			const tmpl = configTemplate.appendExtraData({
				aa: '[string] something...',
			}, {
				bb: 'otherthing',
				xx: { cc: 'morething' }
			});
			expect(tmpl).to.deep.equal({
				aa: '[string] something...',
				bb: '[string] Defaults to "otherthing"',
				xx: { cc: '[string] Defaults to "morething"' }
			});
		});

		it ('do not add data fields in a parent declared as `[json]`', function(){
			const tmpl = configTemplate.appendExtraData({
				aa: '[string] something...',
				xx: '[json] anything...'
			}, {
				bb: 'otherthing',
				xx: { cc: 'morething' }
			});
			expect(tmpl).to.be.deep.equal({
				aa: '[string] something...',
				bb: '[string] Defaults to "otherthing"',
				xx: '[json] anything...'
			});
		});

		it('nested json field', function() {
		  var tmpl = configTemplate.appendExtraData({
		      aa: '[string] something...',
		      xx: {
		        test: '[string] foo',
		        json: '[json] anything...'
		      }
		    },
		    {
		      bb: 'otherthing',
		      xx: { test: 'morething', json: { a: 'b' } }
		    }
		  );
		  tmpl.should.be.deep.equal({
		    aa: '[string] something...',
		    bb: '[string] Defaults to "otherthing"',
		    xx: {
		      test: '[string] foo',
		      json: '[json] anything...'
		    }
		  });
		});

	});

	describe('interpretTmpl', function(){

		it ('recognize template structure', function(){
			const parsedTmpl = configTemplate.interpretTmpl({
				env: '[string] The environment.',
				port: '[number] to open',
				db: {
					user: '[string] DB user.',
					passwd: '[string] DB password.'
				}
			});
			expect(parsedTmpl).to.be.deep.equal({
				lines: [
					{
						type: 'string', deleted: false, empty: false, line: 1, value: '',
						help: '[string] The environment.',
						path: ['env']
					}, {
						type: 'number', deleted: false, empty: false, line: 2, value: '',
						help: '[number] to open',
						path: ['port']
					}, {
						type: 'string', deleted: false, empty: false, line: 3, value: '',
						help: '[string] DB user.',
						path: ['db', 'user']
					}, {
						type: 'string', deleted: false, empty: false, line: 4, value: '',
						help: '[string] DB password.',
						path: ['db', 'passwd']
					}
				],
				counter: 5
			});
		});

		it('throws error if template format is incorrect', function() {
			expect(() => {
				configTemplate.interpretTmpl({
					env: 'The environment.',
					port: 123,
					ok: true
				})
			}).to.throw('The environment. does not adhere to template syntax: [string|number|boolean|json] help message');
		});

	});

	describe('setDefaultValues', function() {

		it('Add values to parsed template', function(){
			const parsedTmpl = configTemplate.interpretTmpl({
				env: '[string] The environment.',
				port: '[number] to open',
				db: {
					user: '[string] DB user.'
				}
			});
			configTemplate.setDefaultValues(parsedTmpl, {
				env: 'Testing',
				port: 1234,
				db: {
					user: 'someone'
				}
			});
			expect(parsedTmpl).to.be.deep.equal({
				lines: [
					{
						type: 'string', deleted: false, empty: false, line: 1,
						value: 'Testing',
						help: '[string] The environment.',
						path: ['env']
					}, {
						type: 'number', deleted: false, empty: false, line: 2,
						value: '1234',
						help: '[number] to open',
						path: ['port']
					}, {
						type: 'string', deleted: false, empty: false, line: 3,
						value: 'someone',
						help: '[string] DB user.',
						path: ['db', 'user']
					}
				],
				counter: 4
			});
		});

		it('ignore missing values', function(){
			var parsedTmpl = configTemplate.interpretTmpl({
				aa: '[string] something...',
				bb: '[number] otherthing...'
			});
			configTemplate.setDefaultValues(parsedTmpl, {
				aa: 'some value'
			});
			parsedTmpl.should.be.deep.equal({
				lines: [
					{
						type: 'string', deleted: false, empty: false, line: 1,
						value: 'some value',
						help: '[string] something...',
						path: ['aa']
					}, {
						type: 'number', deleted: false, empty: false, line: 2,
						value: '',
						help: '[number] otherthing...',
						path: ['bb']
					}
				],
				counter: 3
			});
		});

		it('ignore extra values', function(){
			var parsedTmpl = configTemplate.interpretTmpl({
				aa: '[string] something...',
				bb: '[number] otherthing...'
			});
			configTemplate.setDefaultValues(parsedTmpl, {
				aa: 'some value',
				cc: 'other value'
			});
			parsedTmpl.should.be.deep.equal({
				lines: [
					{
						type: 'string', deleted: false, empty: false, line: 1,
						value: 'some value',
						help: '[string] something...',
						path: ['aa']
					}, {
						type: 'number', deleted: false, empty: false, line: 2,
						value: '',
						help: '[number] otherthing...',
						path: ['bb']
					}
				],
				counter: 3
			});
		});

	});

});
