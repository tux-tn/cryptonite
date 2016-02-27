import _ from 'underscore';
import AudioHandler from './audio';
import CryptoUtil from './crypto';
import { Payload, Parser } from './payload';
import User from './user';
import uuid from 'uuid';

export default class Darkwire {
  constructor() {
    this._audio = new AudioHandler();
    this._cryptoUtil = new CryptoUtil();
    this._user = false;
    this._connected = false;
    this._users = [];
    this._fileQueue = [];
    this._keys = {};
  }

  getFile(id) {
    let file = _.findWhere(this._fileQueue, {id: id}) || false;

    if (file) {
      // TODO: Destroy object from memory when retrieved
    }

    return file.data;
  }

  get keys() {
    return this._keys;
  }

  set keys(keys) {
    this._keys = keys;
    return this._keys;
  }

  get connected() {
    return this._connected;
  }

  set connected(state) {
    this._connected = state;
    return this._connected;
  }

  get audio() {
    return this._audio;
  }

  get users() {
    return this._users;
  }

  getUserById(id) {
    return _.findWhere(this._users, {id: id});
  }

  updateUser(data) {
    return new Promise((resolve, reject) => {
      let user = this.getUserById(data.id);

      if (!user) {
        return reject('User cannot be found');
      }

      let oldUsername = user.username;

      user.username = data.username;
      resolve(oldUsername);
    });
  }

  addUser(data) {
    let importKeysPromises = [];
    // Import all user keys if not already there
    _.each(data.users, (user) => {
      if (!_.findWhere(this._users, {id: user.id})) {
        let promise = new Promise((resolve, reject) => {
          let currentUser = user;
          Promise.all([
            this._cryptoUtil.importPrimaryKey(currentUser.publicKey, 'spki')
          ])
          .then((keys) => {
            this._users.push({
              id: currentUser.id,
              username: currentUser.username,
              publicKey: keys[0]
            });
            resolve();
          });
        });

        importKeysPromises.push(promise);
      }
    });

    if (!this._user) {
      // Set my id if not already set
      let me = _.findWhere(data.users, {username: username});
      this._user = me;
      debugger;
    }

    return importKeysPromises;
  }

  createUser(username) {
    return new Promise((resolve, reject) => {
      if (this._user) {
        return reject('User session already exists');
      }

      Promise.all([
      this._cryptoUtil.createPrimaryKeys()
    ])
    .then((data) => {
      this._keys = {
        public: data[0].publicKey,
        private: data[0].privateKey
      };
      return Promise.all([
        this._cryptoUtil.exportKey(data[0].publicKey, 'spki')
      ]);
    })
    .then((exportedKeys) => {
      if (!exportedKeys) {
        return reject('Could not create a user session');
      }

      this._user = {
        id: uuid.v4(),
        username: username,
        publicKey: exportedKeys[0]
      };
      this._users.push(this._user);

      return resolve(this._user);
    });
    });
  }

  checkSessionUsernames(username) {
    let matches = _.find(this._users, (users) => {
      return username.toLowerCase() === users.username.toLowerCase();
    });

    if (matches && matches.username) {
      return matches;
    }

    return false;
  }

  removeUser(data) {
    this._users = _.without(this._users, _.findWhere(this._users, {id: data.id}));
    return this._users;
  }

  updateUsername(username) {
    let user = null;

    return new Promise((resolve, reject) => {
      // Check if user is here
      if (username) {
        user = this.getUserById(this._user.id);
      }

      if (user) {
        // User exists and is attempting to change username
        // Check if anyone else is using the requested username
        let userExists = this.checkSessionUsernames(username);

        if (userExists) {
          // Someone else is using the username requested, allow reformatting
          // if it is owned by the user, else reject the promise
          if (userExists.id !== this._user.id) {
            return reject(username + ' is being used by someone else in this chat session.');
          }
        }

        return resolve({
          username: username,
          publicKey: user.publicKey
        });
      }

      return reject('Could not update ' + username);
    });
  }

  encode(data) {
    // Don't send unless other users exist
    return new Promise((resolve, reject) => {
      let payload = null;

      if (this._user === data) {
        payload = new Payload(this._user);
      } else {
        payload = this._user ? new Payload(this._user, data) : false;
      }

      if (!payload) {
        return reject('Could not encode data');
      }

      let vector = this._cryptoUtil.crypto.getRandomValues(new Uint8Array(16));
      let secretKey = null;
      let secretKeys = null;
      let signature = null;
      let signingKey = null;
      let payloadData = null;
      let payloadToEncode = payload.stringify();

      this._cryptoUtil.createSecretKey()
          .then((key) => {
            secretKey = key;
            return this._cryptoUtil.createSigningKey();
          })
          .then((key) => {
            signingKey = key;
            // Generate secretKey and encrypt with each user's public key
            let promises = [];
            if (this._users > 1) {
              _.each(this._users, (user) => {
                // If not me
                if (user.id !== this._user.id) {
                  let promise = this.exportSecretKeys(secretKey, signingKey, user);
                  promises.push(promise);
                }
              });
            } else {
              let modifiedUser = {
                id: this._user.id,
                publicKey: this._keys.public
              };
              promises.push(this.exportSecretKeys(secretKey, signingKey, modifiedUser));
            }
            return Promise.all(promises);
          })
          .then((data) => {
            secretKeys = data;
            payloadData = this._cryptoUtil.convertStringToArrayBufferView(payloadToEncode);
            return this._cryptoUtil.signKey(payloadData, signingKey);
          })
          .then((data) => {
            signature = data;
            return this._cryptoUtil.encryptMessage(payloadData, secretKey, vector);
          })
          .then((payloadData) => {
            resolve({
              payload: this._cryptoUtil.convertArrayBufferViewToString(new Uint8Array(payloadData)),
              vector: this._cryptoUtil.convertArrayBufferViewToString(new Uint8Array(vector)),
              secretKeys: secretKeys,
              signature: this._cryptoUtil.convertArrayBufferViewToString(new Uint8Array(signature))
            });
          });
    });
  }

  decode(data) {
    return new Promise((resolve, reject) => {
      let decrypted = [];
      const vector = 'vector' in data ? data.vector : false;
      const payload = 'payload' in data ? data.payload : false;
      const secretKeys = 'secretKeys' in data ? data.secretKeys : false;
      const signature = 'signature' in data ? data.signature : false;

      let payloadType = this.checkPayloadType(payload);

      const decrypt = (payload, user, users) => {
        if (!payload) {
          return false;
        }
        let payloadData = this._cryptoUtil.convertStringToArrayBufferView(payload);
        let vectorData = this._cryptoUtil.convertStringToArrayBufferView(vector);
        let decryptedPayloadData = null;
        let decryptedPayload = null;
        let mySecretKey = _.find(secretKeys, (key) => {
          return key.id === user.id;
        });

        mySecretKey = mySecretKey || this._keys.privateKey;

        let signatureData = this._cryptoUtil.convertStringToArrayBufferView(signature);
        let secretKeyArrayBuffer = this._cryptoUtil.convertStringToArrayBufferView(mySecretKey.secretKey);
        let signingKeyArrayBuffer = this._cryptoUtil.convertStringToArrayBufferView(mySecretKey.encryptedSigningKey);

        return this._cryptoUtil.decryptSecretKey(secretKeyArrayBuffer, this._keys.private)
              .then((data) => {
                return this._cryptoUtil.importSecretKey(new Uint8Array(data), 'raw');
              })
              .then((data) => {
                let secretKey = data;
                return this._cryptoUtil.decryptMessage(payloadData, secretKey, vectorData);
              })
              .then((data) => {
                decryptedPayloadData = data;
                decryptedPayload = new Parser(this._cryptoUtil.convertArrayBufferViewToString(new Uint8Array(decryptedPayloadData)));
                return this._cryptoUtil.decryptSigningKey(signingKeyArrayBuffer, this._keys.private);
              })
              .then((data) => {
                return this._cryptoUtil.importSigningKey(new Uint8Array(data), 'raw');
              })
              .then((data) => {
                let signingKey = data;
                debugger;
                return this._cryptoUtil.verifyKey(signatureData, decryptedPayload, signingKey);
              })
              .then((bool) => {
                if (bool) {
                  return decryptedPayload;
                }
              });
      };

      if (payloadType) {
        if (payloadType === 'string' || payloadType === 'object') {
          decrypted.push(decrypt(payload, this._user));
        } else if (payloadType === 'array') {
          for (let i = 0; i < payload.length; i++) {
            decrypted.push(decrypt(payload[i], this._user));
          }
        }
      }

      if (decrypted.length > 0) {
        Promise.all(decrypted).then((decryptedData) => {
          resolve(decryptedData);
        });
      } else {
        reject('Could not decrypt payload');
      }
    });
  }

  exportSecretKeys(secretKey, signingKey, user) {
    return new Promise((res, rej) => {
      let secretKeyStr;
      // Export secret key
      this._cryptoUtil.exportKey(secretKey, 'raw')
          .then((data) => {
            return this._cryptoUtil.encryptSecretKey(data, user.publicKey);
          })
          .then((encryptedSecretKey) => {
            secretKeyStr = this._cryptoUtil.convertArrayBufferViewToString(new Uint8Array(encryptedSecretKey));
            // Export HMAC signing key
            return this._cryptoUtil.exportKey(signingKey, 'raw');
          })
          .then((data) => {
            // Encrypt signing key with user's public key
            return this._cryptoUtil.encryptSigningKey(data, user.publicKey);
          })
          .then((encryptedSigningKey) => {
            var str = this._cryptoUtil.convertArrayBufferViewToString(new Uint8Array(encryptedSigningKey));
            res({
              id: user.id,
              secretKey: secretKeyStr,
              encryptedSigningKey: str
            });
          });
    });
  }

  generateMessage(fileId, fileName, messageType) {
    let message = '<div id="file-transfer-request-' + fileId + '">is attempting to send you <strong>' + fileName + '</strong> (' + messageType + ')';
    message += '<br><small class="file-disclaimer"><strong>WARNING: We cannot strictly verify the integrity of this file, its recipients or its owners. By accepting this file, you are liable for any risks that may arise from reciving this file.</strong></small>';
    message += '<br><a class="file-download" onclick="triggerFileDownload(this);" data-file="' + fileId + '">Accept File</a></div>';

    return message;
  }

  addFileToQueue(data) {
    let fileData = {
      id: data.additionalData.fileId,
      data: data
    };
    this._fileQueue.push(fileData);
    return this.generateMessage(data.additionalData.fileId, data.additionalData.fileName, data.messageType);
  }

  checkPayloadType(payload) {
    if (Object.prototype.toString.call(payload) === '[object Array]') {
      return 'array';
    } else if (Object.prototype.toString.call(payload) === '[object Object]') {
      return 'object';
    } else if (Object.prototype.toString.call(payload) === '[object String]') {
      return 'string';
    }

    return false;
  }

}
