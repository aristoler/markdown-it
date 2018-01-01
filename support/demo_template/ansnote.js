/*! markdown-it-ansnote 3.0.1 https://github.com//markdown-it/markdown-it-ansnote @license MIT */(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.markdownitansnote = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Process ansnotes
//
'use strict';

////////////////////////////////////////////////////////////////////////////////
// Renderer partials

function render_ansnote_anchor_name(tokens, idx, options, env/*, slf*/) {
  var n = Number(tokens[idx].meta.id + 1).toString();
  var prefix = '';

  if (typeof env.docId === 'string') {
    prefix = '-' + env.docId + '-';
  }

  return prefix + n;
}

function render_ansnote_caption(tokens, idx/*, options, env, slf*/) {
  var n = Number(tokens[idx].meta.id + 1).toString();

  if (tokens[idx].meta.subId > 0) {
    n += ':' + tokens[idx].meta.subId;
  }

  return '[' + n + ']';
}

function render_ansnote_ref(tokens, idx, options, env, slf) {
  var id      = slf.rules.ansnote_anchor_name(tokens, idx, options, env, slf);
  var caption = slf.rules.ansnote_caption(tokens, idx, options, env, slf);
  var refid   = id;

  if (tokens[idx].meta.subId > 0) {
    refid += ':' + tokens[idx].meta.subId;
  }

  return '<sup class="ansnote-ref"><a href="#fn' + id + '" id="fnref' + refid + '">' + caption + '</a></sup>';
}

function render_ansnote_block_open(tokens, idx, options) {
  return (options.xhtmlOut ? '<hr class="ansnotes-sep" />\n' : '<hr class="ansnotes-sep">\n') +
         '<section class="ansnotes">\n' +
         '<ol class="ansnotes-list">\n';
}

function render_ansnote_block_close() {
  return '</ol>\n</section>\n';
}

function render_ansnote_open(tokens, idx, options, env, slf) {
  var id = slf.rules.ansnote_anchor_name(tokens, idx, options, env, slf);

  if (tokens[idx].meta.subId > 0) {
    id += ':' + tokens[idx].meta.subId;
  }

  return '<li id="fn' + id + '" class="ansnote-item">';
}

function render_ansnote_close() {
  return '</li>\n';
}

function render_ansnote_anchor(tokens, idx, options, env, slf) {
  var id = slf.rules.ansnote_anchor_name(tokens, idx, options, env, slf);

  if (tokens[idx].meta.subId > 0) {
    id += ':' + tokens[idx].meta.subId;
  }

  /* ↩ with escape code to prevent display as Apple Emoji on iOS */
  return ' <a href="#fnref' + id + '" class="ansnote-backref">\u21a9\uFE0E</a>';
}


module.exports = function ansnote_plugin(md) {
  var parseLinkLabel = md.helpers.parseLinkLabel,
      isSpace = md.utils.isSpace;

  md.renderer.rules.ansnote_ref          = render_ansnote_ref;
  md.renderer.rules.ansnote_block_open   = render_ansnote_block_open;
  md.renderer.rules.ansnote_block_close  = render_ansnote_block_close;
  md.renderer.rules.ansnote_open         = render_ansnote_open;
  md.renderer.rules.ansnote_close        = render_ansnote_close;
  md.renderer.rules.ansnote_anchor       = render_ansnote_anchor;

  // helpers (only used in other rules, no tokens are attached to those)
  md.renderer.rules.ansnote_caption      = render_ansnote_caption;
  md.renderer.rules.ansnote_anchor_name  = render_ansnote_anchor_name;

  // Process ansnote block definition
  function ansnote_def(state, startLine, endLine, silent) {
    var oldBMark, oldTShift, oldSCount, oldParentType, pos, label, token,
        initial, offset, ch, posAfterColon,
        start = state.bMarks[startLine] + state.tShift[startLine],
        max = state.eMarks[startLine];

    // line should be at least 5 chars - "[^x]:"
    if (start + 4 > max) { return false; }

    if (state.src.charCodeAt(start) !== 0x5B/* [ */) { return false; }
    if (state.src.charCodeAt(start + 1) !== 0x23/* # */) { return false; }

    for (pos = start + 2; pos < max; pos++) {
      if (state.src.charCodeAt(pos) === 0x20) { return false; }
      if (state.src.charCodeAt(pos) === 0x5D /* ] */) {
        break;
      }
    }

    if (pos === start + 2) { return false; } // no empty ansnote labels
    if (pos + 1 >= max || state.src.charCodeAt(++pos) !== 0x3A /* : */) { return false; }
    if (silent) { return true; }
    pos++;

    if (!state.env.ansnotes) { state.env.ansnotes = {}; }
    if (!state.env.ansnotes.refs) { state.env.ansnotes.refs = {}; }
    label = state.src.slice(start + 2, pos - 2);
    state.env.ansnotes.refs[':' + label] = -1;

    token       = new state.Token('ansnote_reference_open', '', 1);
    token.meta  = { label: label };
    token.level = state.level++;
    state.tokens.push(token);

    oldBMark = state.bMarks[startLine];
    oldTShift = state.tShift[startLine];
    oldSCount = state.sCount[startLine];
    oldParentType = state.parentType;

    posAfterColon = pos;
    initial = offset = state.sCount[startLine] + pos - (state.bMarks[startLine] + state.tShift[startLine]);

    while (pos < max) {
      ch = state.src.charCodeAt(pos);

      if (isSpace(ch)) {
        if (ch === 0x09) {
          offset += 4 - offset % 4;
        } else {
          offset++;
        }
      } else {
        break;
      }

      pos++;
    }

    state.tShift[startLine] = pos - posAfterColon;
    state.sCount[startLine] = offset - initial;

    state.bMarks[startLine] = posAfterColon;
    state.blkIndent += 4;
    state.parentType = 'ansnote';

    if (state.sCount[startLine] < state.blkIndent) {
      state.sCount[startLine] += state.blkIndent;
    }

    state.md.block.tokenize(state, startLine, endLine, true);

    state.parentType = oldParentType;
    state.blkIndent -= 4;
    state.tShift[startLine] = oldTShift;
    state.sCount[startLine] = oldSCount;
    state.bMarks[startLine] = oldBMark;

    token       = new state.Token('ansnote_reference_close', '', -1);
    token.level = --state.level;
    state.tokens.push(token);

    return true;
  }

  // Process inline ansnotes (^[...])
  function ansnote_inline(state, silent) {
    var labelStart,
        labelEnd,
        ansnoteId,
        token,
        tokens,
        max = state.posMax,
        start = state.pos;

    if (start + 2 >= max) { return false; }
    if (state.src.charCodeAt(start) !== 0x5E/* ^ */) { return false; }
    if (state.src.charCodeAt(start + 1) !== 0x5B/* [ */) { return false; }

    labelStart = start + 2;
    labelEnd = parseLinkLabel(state, start + 1);

    // parser failed to find ']', so it's not a valid note
    if (labelEnd < 0) { return false; }

    // We found the end of the link, and know for a fact it's a valid link;
    // so all that's left to do is to call tokenizer.
    //
    if (!silent) {
      if (!state.env.ansnotes) { state.env.ansnotes = {}; }
      if (!state.env.ansnotes.list) { state.env.ansnotes.list = []; }
      ansnoteId = state.env.ansnotes.list.length;

      state.md.inline.parse(
        state.src.slice(labelStart, labelEnd),
        state.md,
        state.env,
        tokens = []
      );

      token      = state.push('ansnote_ref', '', 0);
      token.meta = { id: ansnoteId };

      state.env.ansnotes.list[ansnoteId] = { tokens: tokens };
    }

    state.pos = labelEnd + 1;
    state.posMax = max;
    return true;
  }

  // Process ansnote references ([^...])
  function ansnote_ref(state, silent) {
    var label,
        pos,
        ansnoteId,
        ansnoteSubId,
        token,
        max = state.posMax,
        start = state.pos;

    // should be at least 4 chars - "[^x]"
    if (start + 3 > max) { return false; }

    if (!state.env.ansnotes || !state.env.ansnotes.refs) { return false; }
    if (state.src.charCodeAt(start) !== 0x5B/* [ */) { return false; }
    if (state.src.charCodeAt(start + 1) !== 0x23/* # */) { return false; }

    for (pos = start + 2; pos < max; pos++) {
      if (state.src.charCodeAt(pos) === 0x20) { return false; }
      if (state.src.charCodeAt(pos) === 0x0A) { return false; }
      if (state.src.charCodeAt(pos) === 0x5D /* ] */) {
        break;
      }
    }

    if (pos === start + 2) { return false; } // no empty ansnote labels
    if (pos >= max) { return false; }
    pos++;

    label = state.src.slice(start + 2, pos - 1);
    if (typeof state.env.ansnotes.refs[':' + label] === 'undefined') { return false; }

    if (!silent) {
      if (!state.env.ansnotes.list) { state.env.ansnotes.list = []; }

      if (state.env.ansnotes.refs[':' + label] < 0) {
        ansnoteId = state.env.ansnotes.list.length;
        state.env.ansnotes.list[ansnoteId] = { label: label, count: 0 };
        state.env.ansnotes.refs[':' + label] = ansnoteId;
      } else {
        ansnoteId = state.env.ansnotes.refs[':' + label];
      }

      ansnoteSubId = state.env.ansnotes.list[ansnoteId].count;
      state.env.ansnotes.list[ansnoteId].count++;

      token      = state.push('ansnote_ref', '', 0);
      token.meta = { id: ansnoteId, subId: ansnoteSubId, label: label };
    }

    state.pos = pos;
    state.posMax = max;
    return true;
  }

  // Glue ansnote tokens to end of token stream
  function ansnote_tail(state) {
    var i, l, j, t, lastParagraph, list, token, tokens, current, currentLabel,
        insideRef = false,
        refTokens = {};

    if (!state.env.ansnotes) { return; }

    state.tokens = state.tokens.filter(function (tok) {
      if (tok.type === 'ansnote_reference_open') {
        insideRef = true;
        current = [];
        currentLabel = tok.meta.label;
        return false;
      }
      if (tok.type === 'ansnote_reference_close') {
        insideRef = false;
        // prepend ':' to avoid conflict with Object.prototype members
        refTokens[':' + currentLabel] = current;
        return false;
      }
      if (insideRef) { current.push(tok); }
      return !insideRef;
    });

    if (!state.env.ansnotes.list) { return; }
    list = state.env.ansnotes.list;

    token = new state.Token('ansnote_block_open', '', 1);
    state.tokens.push(token);

    for (i = 0, l = list.length; i < l; i++) {
      token      = new state.Token('ansnote_open', '', 1);
      token.meta = { id: i, label: list[i].label };
      state.tokens.push(token);

      if (list[i].tokens) {
        tokens = [];

        token          = new state.Token('paragraph_open', 'p', 1);
        token.block    = true;
        tokens.push(token);

        token          = new state.Token('inline', '', 0);
        token.children = list[i].tokens;
        token.content  = '';
        tokens.push(token);

        token          = new state.Token('paragraph_close', 'p', -1);
        token.block    = true;
        tokens.push(token);

      } else if (list[i].label) {
        tokens = refTokens[':' + list[i].label];
      }

      state.tokens = state.tokens.concat(tokens);
      if (state.tokens[state.tokens.length - 1].type === 'paragraph_close') {
        lastParagraph = state.tokens.pop();
      } else {
        lastParagraph = null;
      }

      t = list[i].count > 0 ? list[i].count : 1;
      for (j = 0; j < t; j++) {
        token      = new state.Token('ansnote_anchor', '', 0);
        token.meta = { id: i, subId: j, label: list[i].label };
        state.tokens.push(token);
      }

      if (lastParagraph) {
        state.tokens.push(lastParagraph);
      }

      token = new state.Token('ansnote_close', '', -1);
      state.tokens.push(token);
    }

    token = new state.Token('ansnote_block_close', '', -1);
    state.tokens.push(token);
  }

  md.block.ruler.before('reference', 'ansnote_def', ansnote_def, { alt: [ 'paragraph', 'reference' ] });
  md.inline.ruler.after('image', 'ansnote_inline', ansnote_inline);
  md.inline.ruler.after('ansnote_inline', 'ansnote_ref', ansnote_ref);
  md.core.ruler.after('inline', 'ansnote_tail', ansnote_tail);
};

},{}]},{},[1])(1)
});
