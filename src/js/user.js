/**
 * User model
 */

export default class User {
  constructor(user = {}) {
    this._username = user.username;
    this._publicKey = user.publicKey;
  }

  get username() {
    return this._username;
  }

  set username(username) {
    this._username = username;
    return this;
  }

  get publicKey() {
    return this._publicKey;
  }

  set publicKey(publicKey) {
    this._publicKey = publicKey;
    return this;
  }
}
