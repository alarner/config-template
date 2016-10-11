var should = require('chai').should();
var helper = require('./helper');
var configTemplate = require('..');

describe('Editor Helpers', function(){

  describe('interpretTmpl', function(){

    it ('recognize template structure', function(){
      var parsedTmpl = configTemplate.interpretTmpl({
        env: '[string] The environment.',
        port: '[number] to open',
        db: {
          user: '[string] DB user.',
          passwd: '[string] DB password.'
        }
      });
      parsedTmpl.should.be.deep.equal({
        lines: [
          {
            type: "string", deleted: false, empty: false, line: 1, value: "",
            help: "[string] The environment.",
            path: ["env"]
          }, {
            type: "number", deleted: false, empty: false, line: 2, value: "",
            help: "[number] to open",
            path: ["port"]
          }, {
            type: "string", deleted: false, empty: false, line: 3, value: "",
            help: "[string] DB user.",
            path: ["db", "user"]
          }, {
            type: "string", deleted: false, empty: false, line: 4, value: "",
            help: "[string] DB password.",
            path: ["db", "passwd"]
          }
        ],
        counter: 5
      });
    });

    it ('it deduces template item type', function(){
      var parsedTmpl = configTemplate.interpretTmpl({
        env: 'The environment.',
        port: 123,
        ok: true
      });
      parsedTmpl.should.be.deep.equal({
        lines: [
          {
            type: 'string', deleted: false, empty: false, line: 1,
            value: 'The environment.',
            help: '[string] Defaults to "The environment."',
            path: ['env']
          }, {
            type: 'number', deleted: false, empty: false, line: 2,
            value: '123',
            help: '[number] Defaults to 123',
            path: ['port']
          }, {
            type: 'boolean', deleted: false, empty: false, line: 3,
            value: 'true',
            help: '[boolean] Defaults to true',
            path: ['ok']
          }
        ],
        counter: 4
      });
    });

  });

});

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
    fakeSTDIN.keypress({name:'down'})
    fakeSTDIN.write('123');
    fakeSTDIN.keypress({name:'down'})
    fakeSTDIN.write('true');
    fakeSTDIN.keypress({name:'down'})
    fakeSTDIN.write('someone');
    fakeSTDIN.keypress({name:'down'})
    fakeSTDIN.write('mysecret');
    fakeSTDIN.keypress({name:'down'})
    fakeSTDIN.write('that-database');
    fakeSTDIN.keypress({name:'s', ctrl:true})
  });

});
