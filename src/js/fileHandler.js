import _ from 'underscore';
import uuid from 'uuid';

export default class FileHandler {
  constructor(darkwire, socket, chat) {
    this.localFileQueue = [];
    if (window.File && window.FileReader && window.FileList && window.Blob && window.btoa && window.atob && window.Blob && window.URL) {
      this._isSupported = true;
      this.darkwire = darkwire;
      this.socket = socket;
      this.chat = chat;
      this.listen();
    } else {
      this._isSupported = false;
    }
  }

  get isSupported() {
    return this._isSupported;
  }

  set isSupported(state) {
    this._isSupported = state;
    return this;
  }

  confirmTransfer(event) {
    const validFileTypes = ['png','jpg','jpeg','gif','zip','rar','gzip','pdf','txt','json','doc','docx','csv','js','html','css','xslx','csv'];
    const file = event.target.files && event.target.files[0];

    if (file) {
      const fileExt = file.name.split('.').pop().toLowerCase();

      if (validFileTypes.indexOf(fileExt) <= -1) {
        this.chat.addChatMessage({
          username: username,
          message: 'Type de fichier non supporté.'
        });
        return false;
      }

      // Support for only 1MB
      if (file.size > 1000000) {
        this.chat.addChatMessage({
          username: username,
          message: 'La taille maximum de fichier autorisée est de 1Mio'
        });
        return false;
      }
      let fileId = uuid.v4();

      let confirmMessage = '<span id="transfer-' + fileId + '" class="file-presend-prompt">Vous allez envoyer <strong>' + file.name + '</strong> à tous les participants dans ce chat. <a class="file-trigger-confirm" onclick="triggerFileTransfer(this);" data-file="' + fileId + '">Confirmer</a> | <a class="file-trigger-cancel" onclick="triggerFileDestroy(this)" data-file="' + fileId + '">Annuler</a></span>';
      let fileData = {
        id: fileId,
        file: file
      };
      this.localFileQueue.push(fileData);
      this.chat.addChatMessage({
        username: username,
        message: confirmMessage
      });
      this.filesSent++;

    }

    return false;
  }

  encodeFile(fileId) {
    const fileData = _.findWhere(this.localFileQueue, {id: fileId});
    const file = fileData.file || false;

    if (file) {
      // TODO: Remove file from local queue
    } else {
      return false;
    }

    const reader = new FileReader();
    const fileType = file.type || 'file';

    reader.onload = (readerEvent) => {
      const base64 = window.btoa(readerEvent.target.result);
      const additionalData = {
        fileId: fileId,
        fileName: file.name
      };
      this.darkwire.encodeMessage(base64, fileType, additionalData).then((socketData) => {
        this.chat.replaceMessage('#transfer-' + fileId, 'a envoyé <strong>' + file.name + '</strong>');
        this.socket.emit('new message', socketData);
      });
      this.resetInput();
    };

    reader.readAsBinaryString(file);
  }

  destroyFile(fileId) {
    const file = _.findWhere(this.localFileQueue, {id: fileId});
    this.localFileQueue = _.without(this.localFileQueue, file);
    this.resetInput();
    return this.chat.replaceMessage('#transfer-' + fileId, 'Le transfert de fichier pour <strong>' + file.file.name + '</strong> a été annulé.');
  }

  createBlob(base64, fileType) {
    base64 = unescape(base64);
    return new Promise((resolve, reject) => {
      const sliceSize = 1024;
      let byteCharacters = window.atob(base64);
      let byteArrays = [];

      for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
        let slice = byteCharacters.slice(offset, offset + sliceSize);

        let byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
          byteNumbers[i] = slice.charCodeAt(i);
        }

        let byteArray = new Uint8Array(byteNumbers);

        byteArrays.push(byteArray);
      }

      resolve(new window.Blob(byteArrays, {type: fileType}));
    });
  }

  createUrlFromBlob(blob) {
    return window.URL.createObjectURL(blob);
  }

  listen() {
    // browser API
    document.getElementById('fileInput').addEventListener('change', this.confirmTransfer.bind(this), false);
    return this;
  }

  resetInput() {
    document.getElementById('fileInput').value = '';
  }
}
