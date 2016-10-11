var should = require('chai').should();
var helper = require('./helper');
var configTemplate = require('..');

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
