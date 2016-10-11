var EventEmitter = require('events');

var sleep = exports.sleep = function sleep(ms) {
  var sleepInit = Date.now();
  while( sleepInit+ms > Date.now() ) { /* sleep */ }
}

var FakeSTDIN = exports.FakeSTDIN = function FakeSTDIN() { }
FakeSTDIN.prototype = new EventEmitter();
FakeSTDIN.prototype.pause = function(){ };
FakeSTDIN.prototype.resume = function(){ };
FakeSTDIN.prototype.setRawMode = function(){ };
FakeSTDIN.prototype.setEncoding = function(){ };
FakeSTDIN.prototype.write = function(data) {
  for (var char,i=0; char=data[i]; i++) {
    this.keypress({name:char});
  }
};
FakeSTDIN.prototype.keypress = function(data) {
  sleep(33); // because we need to see that working.
  this.emit('keypress', data.name, data);
};
FakeSTDIN.prototype._read = function() {
  var tmp = this.data;
  this.data = '';
  return tmp;
};
