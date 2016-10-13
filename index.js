var uuid = require('uuid');
var bodyParser = require('body-parser');
var app = require('express')();
var server = require('http').Server(app);

var API_ADDR = 'apiv2.cloudwarehub.com';
var API_PORT = 80;
var hosts = [];

create(server);


app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({extended: true}));

app.post('/instances', function(req, res) {
  console.log(req.body);
  var host_id = req.body.host_id;
  var cmd = req.body.cmd;
  var sysname = req.body.sysname;
  var width = req.body.width;
  var height = req.body.height;

  var sock_host = findHost(host_id);

  if (sock_host) {
    sock_host.socket.emit('run', {sysname: sysname, cmd: cmd, width: width, height: height});
    res.sendStatus(200);
  } else {
    res.sendStatus(500);
  }
});
app.post('/user', function(req, res) {
  var sysname = req.body.sysname;
  if (!hosts[0]) {
    res.sendStatus(500);
  } else {
    hosts[0].socket.emit('createuser', {sysname: sysname});
    res.sendStatus(200);
  }
});
server.listen(8081);


function findHost(id) {
  for (var i in hosts) {
    if (hosts[i].id === id) {
      return hosts[i];
    }
  }
  return null;
}

function findHostBySocket(socket) {
  for (var i in hosts) {
    if (hosts[i].socket === socket) {
      return hosts[i];
    }
  }
  return null;
}

function findHostById(id) {
  for (var i in hosts) {
    if (hosts[i].id === id) {
      return hosts[i];
    }
  }
  return null;
}

function create(server) {
  var io = require('socket.io')(server);
  var request = require('request');

  var nsp = io.of('/host');
  var nsp_ara = io.of('/ara');
  nsp.on('connection', function(socket) {
    console.log('new connection');

    socket.on('disconnect', function() {
      console.log('close connection');
      for (var i in hosts) {
        if (hosts[i].socket === socket) {
          hosts.splice(i, 1);
          break;
        }
      }
    });

    socket.on('host_info', function(msg) {
      var host = findHostById(msg.id);
      if (!host) {
        host = {
          id: msg.id,
          socket: socket
        };
        hosts.push(host);
        /* check whether host already created before */
        request.get('http://' + API_ADDR + ":" + API_PORT + '/hosts/' + msg.id).on('response', function(response) {
          if (response.statusCode == 404) {
            /* 调用pyxis api, 创建新host */
            var host_id = msg.id;
            delete msg.id;
            delete msg.cluster_id; // next version will remove cluster feature
            var http = require("http");

            var postData = JSON.stringify({
              data: {
                type: 'hosts',
                id: host_id,
                attributes: msg
              }

            });

            var options = {
              hostname: API_ADDR,
              port: API_PORT,
              path: '/hosts',
              method: 'POST',
              headers: {
                'Content-Type': 'application/vnd.api+json',
                'Content-Length': Buffer.byteLength(postData)
              }
            };
            var req = http.request(options, function(res) {
              console.log('Headers: ' + JSON.stringify(res.headers));
              res.setEncoding('utf8');
              res.on('data', function(body) {
                console.log('Body: ' + body);
              });
            });
            req.on('error', function(e) {
              console.log('problem with request: ' + e.message);
            });
            // write data to request body
            req.write(postData);
            req.end();

          }
        });
      }

    });

  });

  nsp_ara.on('connection', function(socket) {
    console.log('new ara connection');
    socket.join('ara');
  });
}


module.exports = {
  create: create,
  findHost: findHost
}
