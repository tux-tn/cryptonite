import _ from 'underscore';
import express from 'express';
import mustacheExpress from 'mustache-express';
import Io from 'socket.io';
import http from 'http';
import config from 'config';
import bodyparser from 'body-parser';
import cookiesession from 'cookie-session';
import csrf from 'csurf';
import cookieparser from 'cookie-parser';
import helmet from 'helmet';
import cors from 'cors';
import shortid from 'shortid';
import favicon from 'serve-favicon';
import compression from 'compression';
import fs from 'fs';
import crypto from 'crypto';
import Room from './room';

let usage = 0;

const corsOptions = {
  origin: 'http://localhost:3000',
  optionsSuccessStatus: 200
};


const app = express();
const server = http.createServer(app);
const io = Io(server);

let rooms = [];

app.use(helmet());
app.use(cors({origin: config.get('config.cors.origin'),OptionsSuccessStatus: config.get('config.cors.SuccessStatus')}));
app.use(compression());
app.use(favicon(__dirname + '/public/favicon.ico'));
app.engine('mustache', mustacheExpress());
app.set('view engine', 'mustache');
app.set('views', __dirname + '/views');
app.use(express.static(__dirname + '/public'));
app.use(bodyparser.urlencoded({ extended: false }));
app.use(cookiesession(config.get("config.cookieConfig")));
app.use(cookieparser());
app.use(csrf({ cookie: true }));

function generateNewRoom(req, res, id) {
  const room = new Room(io, id);
  rooms.push(room);
  return res.redirect(`/${id}`);
}

app.get('/', (req, res) => {
  if (req.session.isPopulated && req.session.loggedin === true) {
    return res.render('selector');
  } else {
    return res.render('splash',{csrf: req.csrfToken()});
  }
});
app.get('/:roomId', (req, res) => {
  if (req.session.isPopulated && req.session.loggedin === true) {
    const stripName = (name) => {
      const chatName = name.toLowerCase().replace(/[^A-Za-z0-9]/g, '-');
      if (chatName.length >= 50) {
        return chatName.substr(0, 50);
      }
      return chatName;
    };

    const roomId = stripName(req.params.roomId) || false;
    let roomExists = _.findWhere(rooms, {_id: roomId}) || false;

    if (roomExists) {
      return res.render('index', {
        APP: {
          version: process.env.npm_package_version,
          ip: req.headers['x-forwarded-for']
        },
        username: shortid.generate()
      });
    }
    return generateNewRoom(req, res, roomId);
  } else {
    res.redirect('/');
  }
});
app.post('/login', (req,res) => {
  let userPassword = req.body.password;
  let response = {
    error : 1,
    message : ''
  };
  let userPasswordHash = crypto.createHash('sha256').update(userPassword).digest('base64');
  if (userPasswordHash === config.get('config.authHash')) {
    response.error = 0;
    response.message = 'Connecté';
    req.session.loggedin = true;
    res.send(response);
  } else {
    response.message = 'Mot de passe incorrecte';
    res.send(response);
  }
});

server.listen(config.get('config.port'));
