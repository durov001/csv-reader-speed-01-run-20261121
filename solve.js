// A fast reader for broken CSV files, written from the competition's own spec
// (RULES.txt): run(input) returns, for {text, header}, exactly the answer
// csv-reader 1.0.0 returns — {columns, rows, errors} — but reads the text with
// slices instead of one character at a time.
//
// The policy, as the spec states it:
//   - a U+FEFF at the very start is dropped;
//   - a record ends at LF or CRLF, and a line left with no characters is no record;
//   - outside quotes a CR not followed by LF is dropped (stray_cr);
//   - a field that opens with a quote runs to the next quote that is not doubled,
//     "" inside it one quote and each CRLF or lone CR inside it read as LF; what
//     follows its closing quote, up to the next comma or line break, is appended
//     as it stands (quote_junk, when the field ends); a quote that never closes
//     is a literal character, and the text after it is read again as unquoted
//     (unterminated_quote);
//   - a quote inside an unquoted field is a literal character;
//   - columns is the first record when header is true, else null; rows holds the
//     records after it (every record when header is false), each padded with ""
//     (short_row, with fields: its field count) or cut (long_row, with extra:
//     the cut fields) to the first record's width;
//   - each error is {code, line, row}, in the order met, a record's short_row or
//     long_row when it ends: line the 1-based line its record starts on, counting
//     every LF, CRLF and lone CR inside quotes, and row its record's index in
//     rows, null for the header.
//
// Speed comes from three choices. Unquoted fields are scanned with charCodeAt
// and sliced once, never built a character at a time. A quoted field finds its
// closing quote with indexOf and, when it holds no doubled quote and no line
// break, is one slice too; only the rare field with "" or a break inside is
// rebuilt. Errors are the only per-record work beyond the fields, and the
// common record carries none.

const COMMA = 44; // ','
const QUOTE = 34; // '"'
const LF = 10; // '\n'
const CR = 13; // '\r'
const BOM = 0xfeff;

/** How a field ended: at a comma (the record goes on), at a line break, or at the end of the text. */
const AT_COMMA = 0;
const AT_BREAK = 1;
const AT_END = 2;

/** csv-reader 1.0.0's answer for one case's input, read faster. */
export function run(input) {
  const text = typeof input.text === 'string' ? input.text : String(input.text);
  const header = input.header === true;
  const len = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = 0; // the next character to read
  let line = 1; // the line that character is on
  if (len > 0 && text.charCodeAt(0) === BOM) pos = 1;

  // Reads an unquoted field starting at pos, appending it to `value`, and
  // returns [value, ended]. A CR not followed by LF is dropped (stray_cr).
  // Only the rare paths use this helper — junk after a closing quote and the
  // re-read after a quote that never closes; the common unquoted field is
  // inlined in the record loop below.
  function readUnquoted(value, rLine, rRow) {
    let start = pos;
    let i = pos;
    let ended;
    let endPos;
    for (;;) {
      while (i < len) {
        const c = text.charCodeAt(i);
        if (c === COMMA || c === LF || c === CR) break;
        i += 1;
      }
      if (i >= len) {
        ended = AT_END;
        endPos = len;
        break;
      }
      const c = text.charCodeAt(i);
      if (c === COMMA) {
        ended = AT_COMMA;
        endPos = i;
        break;
      }
      if (c === LF) {
        ended = AT_BREAK;
        endPos = i;
        break;
      }
      if (i + 1 < len && text.charCodeAt(i + 1) === LF) {
        ended = AT_BREAK;
        endPos = i;
        break;
      }
      errors.push({ code: 'stray_cr', line: rLine, row: rRow });
      value += text.slice(start, i);
      i += 1;
      start = i;
    }
    value += text.slice(start, endPos);
    if (ended === AT_COMMA) pos = endPos + 1;
    else if (ended === AT_BREAK) {
      pos = endPos + (text.charCodeAt(endPos) === CR ? 2 : 1);
      line += 1;
    } else pos = len;
    return [value, ended];
  }

  // Finishes a record: sets the width from the first record, keeps the header
  // out of rows, and pads or cuts every other record to the width.
  function finishRecord(fields, rLine, rRow) {
    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      return;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: rLine, row: rRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: rLine, row: rRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }

  for (;;) {
    // Lines with no characters are no records.
    while (pos < len) {
      const c = text.charCodeAt(pos);
      if (c === LF) {
        pos += 1;
        line += 1;
      } else if (c === CR && pos + 1 < len && text.charCodeAt(pos + 1) === LF) {
        pos += 2;
        line += 1;
      } else break;
    }
    if (pos >= len) break;

    const recordLine = line;
    const recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let ended = AT_COMMA;
    let quoted = false;
    do {
      quoted = text.charCodeAt(pos) === QUOTE;
      if (!quoted) {
        // An unquoted field: scan to the next comma or line break and slice
        // it once. A stray CR is dropped and the scan resumes after it.
        let start = pos;
        let i = pos;
        let acc = null;
        let endKind;
        let endPos;
        for (;;) {
          while (i < len) {
            const c = text.charCodeAt(i);
            if (c === COMMA || c === LF || c === CR) break;
            i += 1;
          }
          if (i >= len) {
            endKind = AT_END;
            endPos = len;
            break;
          }
          const c = text.charCodeAt(i);
          if (c === COMMA) {
            endKind = AT_COMMA;
            endPos = i;
            break;
          }
          if (c === LF) {
            endKind = AT_BREAK;
            endPos = i;
            break;
          }
          if (i + 1 < len && text.charCodeAt(i + 1) === LF) {
            endKind = AT_BREAK;
            endPos = i;
            break;
          }
          errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
          acc = (acc === null ? '' : acc) + text.slice(start, i);
          i += 1;
          start = i;
        }
        fields.push(acc === null ? text.slice(start, endPos) : acc + text.slice(start, endPos));
        if (endKind === AT_COMMA) {
          pos = endPos + 1;
          ended = AT_COMMA;
        } else if (endKind === AT_BREAK) {
          pos = endPos + (text.charCodeAt(endPos) === CR ? 2 : 1);
          line += 1;
          ended = AT_BREAK;
        } else {
          pos = len;
          ended = AT_END;
        }
        continue;
      }

      // A quoted field: its closing quote is the next quote that is not
      // doubled, found with indexOf.
      const open = pos;
      const openLine = line;
      let closeQ = -1;
      let hasDoubled = false;
      let q = text.indexOf('"', open + 1);
      while (q !== -1) {
        if (q + 1 < len && text.charCodeAt(q + 1) === QUOTE) {
          hasDoubled = true;
          q = text.indexOf('"', q + 2);
          continue;
        }
        closeQ = q;
        break;
      }
      if (closeQ === -1) {
        // The quote never closes: it is a literal character, and the text
        // after it is read again as unquoted.
        pos = open + 1;
        line = openLine;
        errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
        const reread = readUnquoted('"', recordLine, recordRow);
        fields.push(reread[0]);
        ended = reread[1];
        continue;
      }

      let value = text.slice(open + 1, closeQ);
      // A line break inside the quotes must be found to count it — but only
      // inside this field: checking the slice keeps the search bounded to the
      // field itself, where an indexOf on the whole text could run far past
      // it (a lone CR is rare, so the next one may be thousands of characters
      // away in a file whose lines end with LF alone).
      const hasBreak = value.indexOf('\n') !== -1 || value.indexOf('\r') !== -1;
      if (!hasDoubled && !hasBreak) {
        // The slice is the field as it stands.
      } else {
        // Rebuild the field: "" folds to one quote, and each CRLF or lone CR
        // inside it reads as one LF (and counts as a line).
        let v = '';
        let s = open + 1;
        let j = s;
        while (j < closeQ) {
          const c = text.charCodeAt(j);
          if (c === QUOTE) {
            v += text.slice(s, j) + '"';
            j += 2;
            s = j;
          } else if (c === CR) {
            v += text.slice(s, j) + '\n';
            line += 1;
            j += j + 1 < closeQ && text.charCodeAt(j + 1) === LF ? 2 : 1;
            s = j;
          } else if (c === LF) {
            v += text.slice(s, j) + '\n';
            line += 1;
            j += 1;
            s = j;
          } else {
            j += 1;
          }
        }
        v += text.slice(s, closeQ);
        value = v;
      }
      pos = closeQ + 1;
      if (pos >= len) {
        fields.push(value);
        ended = AT_END;
        continue;
      }
      const c = text.charCodeAt(pos);
      if (c === COMMA) {
        fields.push(value);
        pos += 1;
        ended = AT_COMMA;
      } else if (c === LF) {
        fields.push(value);
        pos += 1;
        line += 1;
        ended = AT_BREAK;
      } else if (c === CR && pos + 1 < len && text.charCodeAt(pos + 1) === LF) {
        fields.push(value);
        pos += 2;
        line += 1;
        ended = AT_BREAK;
      } else {
        // What follows the closing quote, up to the next comma or line break,
        // is appended as it stands (quote_junk, when the field ends).
        const before = value.length;
        const junk = readUnquoted(value, recordLine, recordRow);
        if (junk[0].length - before > 0) {
          errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
        }
        fields.push(junk[0]);
        ended = junk[1];
      }
    } while (ended === AT_COMMA);

    // A line that held only stray CRs is left with no characters: no record
    // (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    finishRecord(fields, recordLine, recordRow);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
