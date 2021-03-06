'use strict';

var dl = require('datalib'),
    vg = require('vega'),
    vl = require('vega-lite'),
    AGG_OPS = vg.transforms.aggregate.VALID_OPS,
    getInVis = require('../../util/immutable-utils').getInVis,
    updateMarkProperty = require('../markActions').updateMarkProperty,
    dsUtils = require('../../util/dataset-utils'),
    historyActions = require('../../actions/historyActions'),
    startBatch = historyActions.startBatch,
    endBatch = historyActions.endBatch,
    parseData = require('./parseData'),
    parseScales = require('./parseScales'),
    parseMarks  = require('./parseMarks'),
    parseGuides = require('./parseGuides');

// Vega mark types to Vega-Lite mark types.
var TYPES = {
  rect: 'bar',
  symbol: 'point',
  text: 'text',
  line: 'line',
  area: 'area'
};

var CELLW = 517,
    CELLH = 392;

/**
 * Async action creator that binds the given field to the given mark's property.
 * In particular, a Vega-Lite specification is constructed and parsed to trigger
 * updates across the entire store (e.g., instantiating new data transforms,
 * scales, and guides).
 *
 * @param  {number} dsId     The ID of the dataset that contains the given field.
 * @param  {Object} field    A field schema object.
 * @param  {number} markId   The ID of the mark whose property will be bound.
 * @param  {string} property The name of the property to bind.
 * @returns {Function}       Async action function.
 */
function bindChannel(dsId, field, markId, property) {
  return function(dispatch, getState) {
    var state = getState(),
        mark  = getInVis(state, 'marks.' + markId),
        from  = mark.get('from'),
        markType = mark.get('type'),
        spec = vlSpec(markId, markType),
        mapping = map(markId),
        channel = channelName(property);

    // Though we dispatch multiple actions, we want bindChannel to register as
    // only a single state change to the history from the user's perspective.
    dispatch(startBatch());

    if (from && (from.get('mark') || from.get('data') !== dsId)) {
      throw Error('Mark and field must be from the same pipeline.');
    } else if (!from) {
      dispatch(updateMarkProperty(markId, 'from', {data: dsId}));
    }

    spec.encoding[channel] = channelDef(field);

    var parsed = compile(spec, property, dsId);
    parsed.map = mapping;
    parsed.mark = mark;
    parsed.markId = markId;
    parsed.markType = markType;
    parsed.property = property;
    parsed.channel = channel;
    parsed.dsId = dsId;
    parseData(dispatch, state, parsed);
    parseScales(dispatch, state, parsed);
    parseMarks(dispatch, state, parsed);
    parseGuides(dispatch, state, parsed);

    dispatch(endBatch());
  };
}

/**
 * Compiles a Vega-Lite specification, and returns the resultant Vega spec for
 * further analsis. The current mark's dataset's values are embedded in the VL
 * spec, and config values are supplied to be able to account for VL
 * idiosyncracies.
 *
 * @param   {Object} spec     A Vega-Lite specification.
 * @param   {string} property The Lyra channel being bound.
 * @param   {number} dsId     The ID of the dataset that backs the current mark.
 * @returns {Object}          An object containing the Vega and Vega-Lite specs.
 */
function compile(spec, property, dsId) {
  spec = dl.duplicate(spec);

  // Always drive the Vega-Lite spec by a pipeline's source dataset.
  // We analyze the resultant Vega spec to understand what this mark's
  // backing dataset should actually be (source, aggregate, etc.).
  spec.data.values = dsUtils.output(dsId);

  // Supply custom cell width/heights to be able to differentiate hardcoded
  // scale ranges generated by Vega-Lite.
  spec.config.cell = {
    width: CELLW,
    height: CELLH
  };

  // Force marks to be filled, if we're binding to the fill color property.
  if (property === 'fill') {
    spec.config.mark = {filled: true};
  }

  return {
    input:  spec,
    output: vl.compile(spec).spec
  };
}

/**
 * Constructs a Vega-Lite specification, or returns a previously created one,
 * for the given mark.
 *
 * @param  {number} markId   The ID of the mark.
 * @param  {string} markType The Vega type of the mark.
 * @returns {Object} A Vega-Lite specification.
 */
function vlSpec(markId, markType) {
  var cache = vlSpec.cache || (vlSpec.cache = {});
  return cache[markId] || (cache[markId] = {
    mark: TYPES[markType],
    data: {},
    encoding: {},
    config: {}
  });
}

/**
 * Builds/returns a mapping of primitive names found in a mark's Vega-Lite
 * specification and the corresponding IDs of the primitives in Lyra.
 *
 * @param  {number} markId The ID of the mark.
 * @returns {Object} A mapping object.
 */
function map(markId) {
  var cache = map.cache || (map.cache = {});
  return cache[markId] || (cache[markId] = {
    data: {},
    scales: {},
    axes: {},
    legends: {}
  });
}

/**
 * Returns the Vega-Lite encoding channel name for the given Vega mark property.
 * @param   {string} name A Vega mark property.
 * @returns {string}      A Vega-Lite encoding channel.
 */
function channelName(name) {
  switch (name) {
    case 'x':
    case 'x+':
    case 'x2':
    case 'width':
      return 'x';
    case 'y':
    case 'y+':
    case 'y2':
    case 'height':
      return 'y';
    case 'fill':
    case 'stroke':
      return 'color';
    default:
      return name;
  }
}

var re = {
  agg: new RegExp('^(' + AGG_OPS.join('|') + ')_(.*?)$'),
  bin: new RegExp('^(bin)_(.*?)(_start|_mid|_end)$')
};

/**
 * Constructs a Vega-Lite channel definition. We test to see if the field
 * represents an aggregated or binned field. If it does, we strip out
 * the corresponding aggregate/bin prefix via a RegExp, and instead set
 * the `aggregate` or `bin` keywords necessary for Vega-Lite.
 *
 * @private
 * @memberOf rules
 * @param  {Object} field A field schema object.
 * @returns {Object} A Vega-Lite channel definition.
 */
function channelDef(field) {
  var name = field.name,
      agg = field.aggregate,
      bin = field.bin,
      ref = {type: field.mtype}, res;

  if (agg) {
    res = re.agg.exec(name);
    ref.aggregate = res[1];
  } else if (bin) {
    res = re.bin.exec(name);
    ref.bin = true;
  }

  ref.field = res ? res[2] : name;

  return ref;
}

module.exports = bindChannel;
bindChannel.CELLW = CELLW;
bindChannel.CELLH = CELLH;
dl.extend(bindChannel, require('./helperActions'));
