import * as m from 'mithril';
import * as Vnode from 'mithril/render/vnode';
import * as helper from '../../helper';
import treePath from '../path';
import { empty, renderEval, isSynthetic } from '../util';

import { AnalyseCtrlInterface, AnalysisStep, AnalysisTree, Glyph, Path } from '../interfaces';

interface Turn {
  turn: number
  white?: AnalysisStep
  black?: AnalysisStep
}

export function renderTree(ctrl: AnalyseCtrlInterface, tree: AnalysisTree) {
  const turns: Mithril.Children = [];
  const initPly = ctrl.analyse.firstPly();
  const path = treePath.default()

  if (initPly % 2 === 0) {
    for (let i = 1, nb = tree.length; i < nb; i += 2) turns.push(
      renderTurn(
        ctrl,
        {
          turn: Math.floor((initPly + i) / 2) + 1,
          white: tree[i],
          black: tree[i + 1]
        },
        path
      )
    )
  }
  else {
    turns.push(renderTurn(ctrl, {
      turn: Math.floor(initPly / 2) + 1,
      white: null,
      black: tree[1]
    }, path))
    for (let j = 2, jnb = tree.length; j < jnb; j += 2) turns.push(
      renderTurn(
        ctrl,
        {
          turn: Math.floor((initPly + j) / 2) + 1,
          white: tree[j],
          black: tree[j + 1]
        },
        path
      )
    )
  }

  return turns
}

function renderIndex(txt: string) {
  return Vnode('index', undefined, undefined, undefined, txt, undefined)
}

function turnKey(turn: Turn, meta?: string) {
  const key = turn.turn + ':' + (meta ? meta : '');
  return key;
}

function renderEvalTag(e: string) {
  return Vnode('eval', undefined, undefined, undefined, e, undefined)
}

function renderGlyph(glyph: Glyph) {
  return Vnode('glyph', undefined, undefined, undefined, glyph.symbol, undefined)
}

const emptyMove = Vnode('move', undefined, undefined, undefined, '...', undefined)

function renderMove(currentPath: string, move: AnalysisStep, path: Path) {
  if (!move) return emptyMove;
  const pathStr = treePath.write(path);
  const evaluation = path[1] ? null : (move.rEval || move.ceval);
  const judgment = move.rEval && move.rEval.judgment;
  const className = [
    pathStr === currentPath ? 'current' : ''
  ].join(' ');

  return Vnode('move', undefined, { 'data-path': pathStr, className }, [
    Vnode('#', undefined, undefined, move.san[0] === 'P' ? move.san.slice(1) : move.san, undefined, undefined),
    judgment && judgment.glyph ? renderGlyph(judgment.glyph) : null,
    evaluation && evaluation.cp ? renderEvalTag(renderEval(evaluation.cp)) : (
      evaluation && evaluation.mate ? renderEvalTag('#' + evaluation.mate) : null
    )
  ], undefined, undefined)
}

function plyToTurn(ply: number) {
  return Math.floor((ply - 1) / 2) + 1;
}

function renderVariationMenu(ctrl: AnalyseCtrlInterface, path: Path) {
  const showing = ctrl.vm.variationMenu && ctrl.vm.variationMenu === treePath.write(path.slice(0, 1));

  if (!showing) return null;

  const promotable = isSynthetic(ctrl.data) ||
    !ctrl.analyse.getStepAtPly(path[0].ply).fixed;

  const content = m('div.variationMenu', [
    m('button', {
      className: 'withIcon',
      'data-icon': 'q',
      oncreate: helper.ontap(ctrl.deleteVariation.bind(undefined, path))
    }, 'Delete variation'),
    promotable ? m('button', {
      className: 'withIcon',
      'data-icon': 'E',
      oncreate: helper.ontap(ctrl.promoteVariation.bind(undefined, path))
    }, 'Promote to main line') : null
  ]);

  return (
    <div className="overlay_popup_wrapper variationMenuPopup">
      <div className="popup_overlay_close"
        oncreate={helper.ontap(helper.fadesOut(() => ctrl.toggleVariationMenu(), '.overlay_popup_wrapper'))} />
      <div className="overlay_popup">
        {content}
      </div>
    </div>
  );
}

function renderVariation(ctrl: AnalyseCtrlInterface, variation: AnalysisTree, path: Path) {
  const visiting = treePath.contains(path, ctrl.vm.path);
  return (
    <lines>
      <span className="menuIcon fa fa-ellipsis-v" oncreate={helper.ontapY(() => ctrl.toggleVariationMenu(path))}></span>
      <line className={visiting ? ' visiting' : ''}>
        {renderVariationContent(ctrl, variation, path)}
        {renderVariationMenu(ctrl, path)}
      </line>
    </lines>
  );
}

function renderVariationNested(ctrl: AnalyseCtrlInterface, variation: AnalysisTree, path: Path): Mithril.ChildNode {
  return (
    <span className="nested">
      (
      {renderVariationContent(ctrl, variation, path)}
      )
    </span>
  );
}

function renderVariationContent(ctrl: AnalyseCtrlInterface, variation: AnalysisTree, path: Path) {
  const turns: Turn[] = [];
  if (variation[0].ply % 2 === 0) {
    variation = variation.slice(0);
    const move = variation.shift();
    turns.push({
      turn: plyToTurn(move.ply),
      black: move
    });
  }
  const visiting = treePath.contains(path, ctrl.vm.path);
  const maxPlies = Math.min(visiting ? 999 : (path[2] ? 2 : 4), variation.length);
  for (let i = 0; i < maxPlies; i += 2) turns.push({
    turn: plyToTurn(variation[i].ply),
    white: variation[i],
    black: variation[i + 1]
  });
  return turns.map(turn => renderVariationTurn(ctrl, turn, path));
}

function renderVariationMeta(ctrl: AnalyseCtrlInterface, move: AnalysisStep, path: Path) {
  if (!move || empty(move.variations)) return null;
  return move.variations.map((variation: AnalysisTree, i: number) => {
    return renderVariationNested(ctrl, variation, treePath.withVariation(path, i + 1));
  });
}

function renderVariationTurn(ctrl: AnalyseCtrlInterface, turn: Turn, path: Path) {
  const wPath = turn.white ? treePath.withPly(path, turn.white.ply) : null;
  const wMove = wPath ? renderMove(ctrl.vm.pathStr, turn.white, wPath) : null;
  const wMeta = renderVariationMeta(ctrl, turn.white, wPath);
  const bPath = turn.black ? treePath.withPly(path, turn.black.ply) : null;
  const bMove = bPath ? renderMove(ctrl.vm.pathStr, turn.black, bPath) : null;
  const bMeta = renderVariationMeta(ctrl, turn.black, bPath);
  if (wMove) {
    if (wMeta) return [
        renderIndex(turn.turn + '.'),
        wMove,
        wMeta,
        bMove ? bMove : null,
        bMove ? bMeta : null
    ];
    return [
        renderIndex(turn.turn + '.'),
        wMove,
        bMeta ? ' ' : null,
        bMove ? bMove : null,
        bMove ? bMeta : null
    ];
  }
  return [
      renderIndex(turn.turn + '...'),
      bMove,
      bMeta
  ];
}

function renderMeta(ctrl: AnalyseCtrlInterface, step: AnalysisStep, path: Path) {
  const judgment = step && step.rEval && step.rEval.judgment;
  const opening = ctrl.data.game.opening;
  const moveOpening = (step && opening && opening.ply === step.ply) ? renderCommentOpening(opening) : null;

  if (!step || (!moveOpening && empty(step.variations) && (empty(judgment) || !ctrl.vm.showComments))) return null;

  const children: Mithril.Children = [];
  if (moveOpening) {
    children.push(moveOpening);
  }
  const colorClass = step.ply % 2 === 0 ? 'black ' : 'white ';
  if (ctrl.vm.showComments && !empty(judgment)) {
    children.push(renderComment(judgment.comment, colorClass, judgment.name));
  }
  if (!empty(step.variations)) {
    for (let i = 0, len = step.variations.length; i < len; i++) {
      const variation = step.variations[i];
      if (empty(variation)) return null;
      children.push(renderVariation(
        ctrl,
        variation,
        treePath.withVariation(path, i + 1)
      ));
    }
  }
  return (
    <interrupt>{children}</interrupt>
  );
}

function truncateComment(text: string) {
  if (text.length <= 140) return text;
  return text.slice(0, 125) + ' [...]';
}

function renderCommentOpening(opening: Opening) {
  return Vnode('comment', undefined, undefined, undefined, truncateComment(opening.eco + ' ' + opening.name), undefined)
}

function renderComment(comment: string, colorClass: string, commentClass: string) {
  return Vnode('comment', undefined, { className: colorClass + commentClass }, undefined, truncateComment(comment), undefined)
}

function renderTurn(ctrl: AnalyseCtrlInterface, turn: Turn, path: Path): Mithril.Children {
  const index = renderIndex(String(turn.turn));
  const wPath = turn.white ? treePath.withPly(path, turn.white.ply) : null;
  const bPath = turn.black ? treePath.withPly(path, turn.black.ply) : null;
  const wMove = wPath ? renderMove(ctrl.vm.pathStr, turn.white, wPath) : null;
  const bMove = bPath ? renderMove(ctrl.vm.pathStr, turn.black, bPath) : null;
  const wMeta = renderMeta(ctrl, turn.white, wPath);
  const bMeta = renderMeta(ctrl, turn.black, bPath);
  if (wMove) {
    if (wMeta) {
      const temp = [
        index, wMove, emptyMove,
        wMeta
      ];
      if (bMove) {
        if (bMeta) {
          return m.fragment({ key: turnKey(turn, 'emptyWAndWMetaAndBMeta')}, temp.concat([
            index, emptyMove, bMove,
            bMeta
          ]));
        } else {
          return m.fragment({ key: turnKey(turn, 'emptyWAndWMeta')}, temp.concat([

            index, emptyMove, bMove
          ]));
        }
      } else {
        return m.fragment({ key: turnKey(turn, 'emptyB') }, temp)
      }
    } else if (bMeta) {
      return m.fragment({ key: turnKey(turn, 'bMeta') }, [
        index, wMove, bMove,
        bMeta
      ]);
    } else {
      return m.fragment({ key: turnKey(turn) }, [index, wMove, bMove]);
    }
  }
  else if (bMeta) {
    return m.fragment({ key: turnKey(turn, 'emptyWbMeta') }, [
      index, emptyMove, bMove,
      bMeta
    ]);
  } else {
    return m.fragment({ key: turnKey(turn, 'emptyW') }, [index, emptyMove, bMove]);
  }
}
