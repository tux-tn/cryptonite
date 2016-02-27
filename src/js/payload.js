import _ from 'underscore';

export class Payload {
  // What will be encrypted and sent to the server
  constructor(user = false, data = {}) {
    this.user = user;
    this.message = 'message' in data ? escape(data.message) : null;
    this.messageType = 'messageType' in data ? data.messageType : 'text';
    this.attachments = 'attachments' in data ? data.attachments : null;
    this.action = 'action' in data ? data.action : false;
  }

  // Extend the context of our payload
  extend(obj) {
    return _.extend(this, obj);
  }

  // Convert our class into a string
  stringify() {
    let now = {timestamp: new Date()};
    return JSON.stringify(this.extend(now));
  }

}

export class Parser {
  constructor(decryptedPayload = false) {
    return this.parse(decryptedPayload);
  }

  parse(decryptedPayload) {
    if (!decryptedPayload) {
      return false;
    }
    let json = JSON.parse(decryptedPayload);
    if ('message' in json) {
      json.message = unescape(json.message);
    }

    return json;
  }

}
