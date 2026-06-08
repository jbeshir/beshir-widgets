type RPNItem =
  | { t: 'num'; v: number }
  | { t: 'var' }
  | { t: 'op'; v: string }
  | { t: 'func'; v: string };

type RawToken =
  | { kind: 'num'; val: number }
  | { kind: 'var' }
  | { kind: 'const'; val: number }
  | { kind: 'func'; val: string }
  | { kind: 'op'; val: string }
  | { kind: 'lparen' }
  | { kind: 'rparen' };

const FUNC_NAMES = new Set(['sin', 'cos', 'tan', 'exp', 'log', 'ln', 'sqrt', 'abs']);
const CONST_VALUES: Record<string, number> = { pi: Math.PI, e: Math.E };

const OP_PREC: Record<string, number> = {
  '+': 1, '-': 1, '*': 2, '/': 2, '^': 3, '__neg__': 4,
};
const RIGHT_ASSOC = new Set(['^', '__neg__']);

function tokenize(expr: string): RawToken[] | null {
  const tokens: RawToken[] = [];
  let i = 0;

  while (i < expr.length) {
    const ch = expr[i];

    if (ch === ' ' || ch === '\t' || ch === '\n') { i++; continue; }

    if ((ch >= '0' && ch <= '9') || ch === '.') {
      let num = '';
      while (i < expr.length && ((expr[i] >= '0' && expr[i] <= '9') || expr[i] === '.')) {
        num += expr[i++];
      }
      const val = parseFloat(num);
      if (isNaN(val)) return null;
      tokens.push({ kind: 'num', val });
      continue;
    }

    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_') {
      let ident = '';
      while (i < expr.length && ((expr[i] >= 'a' && expr[i] <= 'z') || (expr[i] >= 'A' && expr[i] <= 'Z') || (expr[i] >= '0' && expr[i] <= '9') || expr[i] === '_')) {
        ident += expr[i++];
      }
      if (ident === 'x') {
        tokens.push({ kind: 'var' });
      } else if (ident in CONST_VALUES) {
        tokens.push({ kind: 'const', val: CONST_VALUES[ident] });
      } else if (FUNC_NAMES.has(ident)) {
        tokens.push({ kind: 'func', val: ident });
      } else {
        return null;
      }
      continue;
    }

    if ('+-*/^'.includes(ch)) {
      tokens.push({ kind: 'op', val: ch });
      i++;
      continue;
    }

    if (ch === '(') { tokens.push({ kind: 'lparen' }); i++; continue; }
    if (ch === ')') { tokens.push({ kind: 'rparen' }); i++; continue; }

    return null;
  }

  // Detect unary minus: replace with synthetic __neg__ operator.
  const result: RawToken[] = [];
  for (let j = 0; j < tokens.length; j++) {
    const tok = tokens[j];
    if (tok.kind === 'op' && tok.val === '-') {
      const prev = result[result.length - 1];
      const isUnary = !prev || prev.kind === 'op' || prev.kind === 'lparen' || prev.kind === 'func';
      result.push(isUnary ? { kind: 'op', val: '__neg__' } : tok);
    } else {
      result.push(tok);
    }
  }

  return result;
}

function toRPN(tokens: RawToken[]): RPNItem[] | null {
  const output: RPNItem[] = [];
  // Operator stack: stores op names, 'LPAREN', or 'F:funcname'.
  const ops: string[] = [];

  for (const tok of tokens) {
    if (tok.kind === 'num' || tok.kind === 'const') {
      output.push({ t: 'num', v: tok.val });
    } else if (tok.kind === 'var') {
      output.push({ t: 'var' });
    } else if (tok.kind === 'func') {
      ops.push('F:' + tok.val);
    } else if (tok.kind === 'lparen') {
      ops.push('LPAREN');
    } else if (tok.kind === 'rparen') {
      // Pop until matching LPAREN.
      while (ops.length > 0 && ops[ops.length - 1] !== 'LPAREN') {
        const top = ops.pop()!;
        if (top.startsWith('F:')) output.push({ t: 'func', v: top.slice(2) });
        else output.push({ t: 'op', v: top });
      }
      if (ops.length === 0) return null; // mismatched parens
      ops.pop(); // discard LPAREN
      // If function is sitting below the paren, pop it too.
      if (ops.length > 0 && ops[ops.length - 1].startsWith('F:')) {
        output.push({ t: 'func', v: ops.pop()!.slice(2) });
      }
    } else if (tok.kind === 'op') {
      const opPrec = OP_PREC[tok.val] ?? 0;
      while (ops.length > 0) {
        const top = ops[ops.length - 1];
        if (top === 'LPAREN') break;
        const topPrec = top.startsWith('F:') ? 10 : (OP_PREC[top] ?? 0);
        if (topPrec > opPrec || (topPrec === opPrec && !RIGHT_ASSOC.has(tok.val))) {
          ops.pop();
          if (top.startsWith('F:')) output.push({ t: 'func', v: top.slice(2) });
          else output.push({ t: 'op', v: top });
        } else {
          break;
        }
      }
      ops.push(tok.val);
    }
  }

  while (ops.length > 0) {
    const top = ops.pop()!;
    if (top === 'LPAREN') return null; // mismatched parens
    if (top.startsWith('F:')) output.push({ t: 'func', v: top.slice(2) });
    else output.push({ t: 'op', v: top });
  }

  return output;
}

function evalRPN(rpn: RPNItem[], x: number): number {
  const stack: number[] = [];

  for (const item of rpn) {
    if (item.t === 'num') {
      stack.push(item.v);
    } else if (item.t === 'var') {
      stack.push(x);
    } else if (item.t === 'op') {
      if (item.v === '__neg__') {
        const a = stack.pop();
        if (a === undefined) return NaN;
        stack.push(-a);
      } else {
        const b = stack.pop();
        const a = stack.pop();
        if (a === undefined || b === undefined) return NaN;
        switch (item.v) {
          case '+': stack.push(a + b); break;
          case '-': stack.push(a - b); break;
          case '*': stack.push(a * b); break;
          case '/': stack.push(a / b); break;
          case '^': stack.push(Math.pow(a, b)); break;
          default: return NaN;
        }
      }
    } else if (item.t === 'func') {
      const a = stack.pop();
      if (a === undefined) return NaN;
      switch (item.v) {
        case 'sin':  stack.push(Math.sin(a)); break;
        case 'cos':  stack.push(Math.cos(a)); break;
        case 'tan':  stack.push(Math.tan(a)); break;
        case 'exp':  stack.push(Math.exp(a)); break;
        case 'log':  stack.push(Math.log10(a)); break;
        case 'ln':   stack.push(Math.log(a)); break;
        case 'sqrt': stack.push(Math.sqrt(a)); break;
        case 'abs':  stack.push(Math.abs(a)); break;
        default: return NaN;
      }
    }
  }

  if (stack.length !== 1) return NaN;
  return stack[0];
}

export function compileExpr(expr: string): ((x: number) => number) | null {
  try {
    const tokens = tokenize(expr.trim());
    if (tokens === null || tokens.length === 0) return null;
    const rpn = toRPN(tokens);
    if (rpn === null || rpn.length === 0) return null;
    return (x: number) => evalRPN(rpn, x);
  } catch {
    return null;
  }
}
