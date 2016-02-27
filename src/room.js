import _ from 'underscore';
import {EventEmitter} from 'events';
import util from 'util';
import User from './js/user';

class Room {
  constructor(io = {}, id = {}) {
    this._id = id;
    this.users = [];

    EventEmitter.call(this);

    const thisIO = io.of(this._id);

    thisIO.on('connection', (socket) => {
      let addedUser = false;

      // when the client emits 'new message', this listens and executes
      socket.on('new message', (data) => {
        // we tell the client to execute 'new message'
        socket.broadcast.emit('new message', {
          username: socket.username,
          id: socket.user.id,
          payload: data.payload,
          secretKeys: data.secretKeys,
          signature: data.signature
        });
      });

      socket.on('add:user', (data) => {
        if (addedUser) { return; }

        console.log(data);

        this.users.push(data);

        socket.user = data;
        addedUser = true;
        console.log('Adding user');

        // Broadcast to ALL sockets, including this one
        thisIO.emit('user:joined', {
          payload: data.payload,
          secretKeys: data.secretKeys,
          signature: data.signature,
          vector: data.vector,
        });
      });

      // when the client emits 'typing', we broadcast it to others
      socket.on('typing', () => {
        socket.broadcast.emit('typing', {
          username: socket.username
        });
      });

      // when the client emits 'stop typing', we broadcast it to others
      socket.on('stop typing', () => {
        socket.broadcast.emit('stop typing', {
          username: socket.username
        });
      });

      // when the user disconnects.. perform this
      socket.on('disconnect', () => {
        if (addedUser) {
          this.users = _.without(this.users, socket.user);

          // echo globally that this client has left
          socket.broadcast.emit('user left', {
            username: socket.username,
            users: this.users,
            id: socket.user.id,
            timestamp: new Date()
          });

          // remove room from rooms array
          if (this.users.length === 0) {
            this.emit('empty');
          }
        }
      });

      // Update user
      socket.on('user:update', (data) => {
        if (data.newUsername.length > 16) {
          return false;
        }
        let user = _.find(this.users, (users) => {
          return users === socket.user;
        });

        if (user) {
          user.username = data.newUsername;
          socket.username = user.username;
          socket.user = user;

          // prefix: update- emit to all
          thisIO.emit('update:user', {
            username: socket.username,
            id: socket.user.id,
            timestamp: new Date()
          });
        }

      });

    });
  }

  roomId() {
    return this.id;
  }
}

util.inherits(Room, EventEmitter);

export default Room;
