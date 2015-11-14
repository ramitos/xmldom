var XMLReader = require('./sax').XMLReader;
var DOMImplementation = require('./dom').DOMImplementation;
var format = require('util').format;


function _locator(l) {
  if (!l) {
    return;
  }

  var lineNumber = l.lineNumber;
  var columnNumber = l.columnNumber;
  var systemId = l.systemId || '';

  return format('\n@%s#[line:%s,col:%s]', systemId, lineNumber, columnNumber);
}

function _toString(chars, start, length) {
  if (typeof chars === 'string') {
    return chars.substr(start, length);
  } else if (chars.length >= start + length || start) {
    return String(chars).substr(start, length);
  }

  return chars;
}

function buildErrorHandler(errorImpl, domBuilder, locator) {
  if (!errorImpl) {
    if (domBuilder instanceof DOMHandler) {
      return domBuilder;
    }
    errorImpl = domBuilder;
  }

  var errorHandler = {}
  var isCallback = errorImpl instanceof Function;
  locator = locator || {}

  function build(key) {
    var fn = errorImpl[key];
    if (!fn) {
      if (isCallback) {
        fn = errorImpl.length === 2 ? function(msg) {
          errorImpl(key, msg)
        } : errorImpl;
      } else {
        var i = arguments.length;
        while (--i) {
          if (fn = errorImpl[arguments[i]]) {
            break;
          }
        }
      }
    }
    errorHandler[key] = fn && function(msg) {
      fn(msg + _locator(locator));
    } || function() {};
  }

  build('warning', 'warn');
  build('error', 'warn', 'warning');
  build('fatalError', 'warn', 'warning', 'error');

  return errorHandler;
}

function position(locator, node) {
  node.lineNumber = locator.lineNumber;
  node.columnNumber = locator.columnNumber;
}

/**
 * Private static helpers treated below as private instance methods, so don't
 * need to add these to the public API; we might use a Relator to also get rid
 * of non-standard public properties
 */
function appendElement(hander, node) {
  if (!hander.currentElement) {
    hander.document.appendChild(node);
  } else {
    hander.currentElement.appendChild(node);
  }
}

/**
 * +ContentHandler+ErrorHandler
 * +LexicalHandler+EntityResolver2
 * -DeclHandler-DTDHandler
 *
 * DefaultHandler:EntityResolver, DTDHandler, ContentHandler, ErrorHandler
 * DefaultHandler2:DefaultHandler,LexicalHandler, DeclHandler, EntityResolver2
 * @link http://www.saxproject.org/apidoc/org/xml/sax/helpers/DefaultHandler.html
 */
function DOMHandler() {
  this.cdata = false;
}

/**
 * @see org.xml.sax.ContentHandler#startDocument
 * @link http://www.saxproject.org/apidoc/org/xml/sax/ContentHandler.html
 */
DOMHandler.prototype = {
  startDocument: function() {
    this.document = new DOMImplementation().createDocument(null, null, null);
    if (this.locator) {
      this.document.documentURI = this.locator.systemId;
    }
  },
  startElement: function(namespaceURI, localName, qName, attrs) {
    var doc = this.document;
    var el = doc.createElementNS(namespaceURI, qName || localName);
    var len = attrs.length;
    appendElement(this, el);
    this.currentElement = el;

    if (this.locator) {
      position(this.locator, el);
    }

    for (var i = 0; i < len; i++) {
      var namespaceURI = attrs.getURI(i);
      var value = attrs.getValue(i);
      var qName = attrs.getQName(i);
      var attr = doc.createAttributeNS(namespaceURI, qName);
      if (attr.getOffset) {
        position(attr.getOffset(1), attr)
      }
      attr.value = attr.nodeValue = value;
      el.setAttributeNode(attr)
    }
  },
  endElement: function(namespaceURI, localName, qName) {
    var current = this.currentElement
    var tagName = current.tagName;
    this.currentElement = current.parentNode;
  },
  startPrefixMapping: function(prefix, uri) {},
  endPrefixMapping: function(prefix) {},
  processingInstruction: function(target, data) {
    var ins = this.document.createProcessingInstruction(target, data);

    if (this.locator) {
      position(this.locator, ins);
    }

    appendElement(this, ins);
  },
  ignorableWhitespace: function(ch, start, length) {},
  characters: function(chars, start, length) {
    chars = _toString.apply(this, arguments)

    if (this.currentElement && chars) {
      if (this.cdata) {
        var charNode = this.document.createCDATASection(chars);
        this.currentElement.appendChild(charNode);
      } else {
        var charNode = this.document.createTextNode(chars);
        this.currentElement.appendChild(charNode);
      }

      if (this.locator) {
        position(this.locator, charNode);
      }
    }
  },
  skippedEntity: function(name) {},
  endDocument: function() {
    this.document.normalize();
  },
  setDocumentLocator: function(locator) {
    this.locator = locator

    if (this.locator) {
      locator.lineNumber = 0;
    }
  },
  // LexicalHandler
  comment: function(chars, start, length) {
    chars = _toString.apply(this, arguments)
    var comm = this.document.createComment(chars);

    if (this.locator) {
      position(this.locator, comm);
    }

    appendElement(this, comm);
  },

  startCDATA: function() {
    // used in characters() methods
    this.cdata = true;
  },
  endCDATA: function() {
    this.cdata = false;
  },

  startDTD: function(name, publicId, systemId) {
    var impl = this.document.implementation;
    if (impl && impl.createDocumentType) {
      var dt = impl.createDocumentType(name, publicId, systemId);

      if (this.locator) {
        position(this.locator, dt);
      }

      appendElement(this, dt);
    }
  },
  /**
   * @see org.xml.sax.ErrorHandler
   * @link http://www.saxproject.org/apidoc/org/xml/sax/ErrorHandler.html
   */
  warning: function(error) {
    console.warn(error, _locator(this.locator));
  },
  error: function(error) {
    console.error(error, _locator(this.locator));
  },
  fatalError: function(error) {
    console.error(error, _locator(this.locator));
    throw error;
  }
};

function DOMParser(options) {
  this.options = options || {
    locator: {}
  };
}

DOMParser.prototype.parseFromString = function(source, mimeType) {
  var options = this.options;
  var sax = new XMLReader();

  // contentHandler and LexicalHandler
  var domBuilder = options.domBuilder || new DOMHandler();
  var errorHandler = options.errorHandler;
  var locator = options.locator;
  var defaultNSMap = options.xmlns || {};

  var entityMap = {
    lt: '<',
    gt: '>',
    amp: '&',
    quot: '"',
    apos: '\''
  }

  if (locator) {
    domBuilder.setDocumentLocator(locator)
  }

  sax.errorHandler = buildErrorHandler(errorHandler, domBuilder, locator);
  sax.domBuilder = options.domBuilder || domBuilder;

  if (/\/x?html?$/.test(mimeType)) {
    entityMap.nbsp = '\xa0';
    entityMap.copy = '\xa9';
    defaultNSMap[''] = 'http://www.w3.org/1999/xhtml';
  }

  if (source) {
    sax.parse(source, defaultNSMap, entityMap);
  } else {
    sax.errorHandler.error('invalid document source');
  }

  return domBuilder.document;
}

/*
 * @link http://www.saxproject.org/apidoc/org/xml/sax/ext/LexicalHandler.html
 * used method of org.xml.sax.ext.LexicalHandler:
 *  #comment(chars, start, length)
 *  #startCDATA()
 *  #endCDATA()
 *  #startDTD(name, publicId, systemId)
 *
 *
 * IGNORED method of org.xml.sax.ext.LexicalHandler:
 *  #endDTD()
 *  #startEntity(name)
 *  #endEntity(name)
 *
 *
 * @link http://www.saxproject.org/apidoc/org/xml/sax/ext/DeclHandler.html
 * IGNORED method of org.xml.sax.ext.DeclHandler
 * 	#attributeDecl(eName, aName, type, mode, value)
 *  #elementDecl(name, model)
 *  #externalEntityDecl(name, publicId, systemId)
 *  #internalEntityDecl(name, value)
 * @link http://www.saxproject.org/apidoc/org/xml/sax/ext/EntityResolver2.html
 * IGNORED method of org.xml.sax.EntityResolver2
 *  #resolveEntity(String name,String publicId,String baseURI,String systemId)
 *  #resolveEntity(publicId, systemId)
 *  #getExternalSubset(name, baseURI)
 * @link http://www.saxproject.org/apidoc/org/xml/sax/DTDHandler.html
 * IGNORED method of org.xml.sax.DTDHandler
 *  #notationDecl(name, publicId, systemId) {};
 *  #unparsedEntityDecl(name, publicId, systemId, notationName) {};
 */
[
  'endDTD',
  'startEntity',
  'endEntity',
  'attributeDecl',
  'elementDecl',
  'externalEntityDecl',
  'internalEntityDecl',
  'resolveEntity',
  'getExternalSubset',
  'notationDecl',
  'unparsedEntityDecl'
].forEach(function(key) {
  DOMHandler.prototype[key] = function() {
    return null
  };
});

exports.XMLSerializer = require('./dom').XMLSerializer;
exports.DOMParser = DOMParser;
exports.DOMImplementation = DOMImplementation;