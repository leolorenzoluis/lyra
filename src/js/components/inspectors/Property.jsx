'use strict';

var React = require('react'),
    connect = require('react-redux').connect,
    Immutable = require('immutable'),
    SignalValue = require('../mixins/SignalValue'),
    ContentEditable = require('../ContentEditable'),
    imutils = require('../../util/immutable-utils'),
    getIn = imutils.getIn,
    getInVis = imutils.getInVis,
    TYPES = require('../../constants/primTypes'),
    resetMarkVisual = require('../../actions/markActions').resetMarkVisual;

function mapStateToProps(state, ownProps) {
  // This is also used with Pipelines, which have no primitive property
  if (!ownProps.primId) {
    return {};
  }

  var propertyState = getInVis(state, ownProps.primType + '.' + ownProps.primId),
      path;

  if (ownProps.name) {
    if (ownProps.primType === TYPES.MARKS) {
      path = 'properties.update.' + ownProps.name;
    } else if (ownProps.primType === TYPES.GUIDES) {
      path = ownProps.name;
    }
  }

  var scale = getIn(propertyState, path + '.scale'),
      scaleName = scale && getInVis(state, 'scales.' + scale + '.name');

  return {
    field:  getIn(propertyState, path + '.field'),
    group:  getIn(propertyState, path + '.group'),
    signal: getIn(propertyState, path + '.signal'),
    value:  getIn(propertyState, path),
    scale:  scale,
    scaleName: scaleName
  };
}

function mapDispatchToProps(dispatch) {
  return {
    resetMarkVisual: function(id, property) {
      dispatch(resetMarkVisual(id, property));
    }
  };
}

var Property = React.createClass({
  propTypes: {
    name: React.PropTypes.string.isRequired,
    label: React.PropTypes.string,
    field: React.PropTypes.string,
    group: React.PropTypes.string,
    scale: React.PropTypes.number,
    scaleName: React.PropTypes.string,
    signal: React.PropTypes.string,
    onChange: React.PropTypes.func,
    value: React.PropTypes.oneOfType([
      React.PropTypes.string, React.PropTypes.number,
      React.PropTypes.bool, React.PropTypes.instanceOf(Immutable.Map)
    ]),
    resetMarkVisual: React.PropTypes.func
  },

  mixins: [SignalValue],

  colorSupport: function() {
    var input = document.createElement('input');
    input.setAttribute('type', 'color');
    return input.type !== 'text';
  },

  unbind: function() {
    var props = this.props;
    props.resetMarkVisual(props.primId, props.name);
  },

  render: function() {
    var state = this.state,
        props = this.props,
        name  = props.name,
        label = props.label,
        type  = props.type,
        scale = props.scale,
        field = props.field,
        value = state.value,
        disabled = props.disabled || props.group,
        onChange = props.onChange || this.handleChange,
        onBlur = props.onBlur,
        colorSupport = this.colorSupport(),
        docId = props.id,
        labelEl, scaleEl, controlEl, extraEl;

    React.Children.forEach(props.children, function(child) {
      var className = child && child.props.className;
      if (className === 'extra') {
        extraEl = child;
      } else if (className === 'control') {
        controlEl = child;
      } else if (type === 'label' || (className && className.indexOf('label') !== -1)) {
        labelEl = child;
      }
    });

    labelEl = labelEl || (<label htmlFor={name}>{label}</label>);
    scaleEl = scale ?
      (<div className="scale" onClick={this.unbind}>{props.scaleName}</div>) : null;

    controlEl = field ?
      (<div className="field" onClick={this.unbind}>{field}</div>) : controlEl;

    if (!controlEl) {
      // TODO: include 'radio' case when it's finished being implementing
      switch (type) {
        case 'number':
          controlEl = (
            <input type="number"
              value={!disabled ? value : ''}
              min={props.min} max={props.max}
              disabled={disabled}
              id={docId}
              onChange={onChange}
              name={name} />
          );
          break;
        case 'range':
          controlEl = (
            <div>
              <input type="range"
                value={!disabled ? value : ''}
                disabled={disabled}
                min={props.min} max={props.max} step={props.step}
                onChange={onChange}
                name={name} />

              <ContentEditable value={!disabled ? value : ''}
                save={onChange} />
            </div>
          );
          break;
        case 'color':
          controlEl = (
            <div>
              <input type={colorSupport ? 'color' : 'text'}
                value={!disabled ? value : ''}
                disabled={disabled}
                name={name}
                onChange={onChange} />

              {colorSupport ? (
                <ContentEditable value={!disabled ? value : ''} save={onChange} />
              ) : null}
            </div>
          );
          break;
        case 'select':
          controlEl = (
            <select value={value}
              onChange={onChange}
              name={name}>
              {props.opts.map(function(o) {
                return (<option key={o} value={o}>{o}</option>);
              }, this)}
            </select>
          );
          break;
        case 'text':
          controlEl = (
            <div>
              <input type="text"
                name={name}
                value={value}
                onChange={onChange}
                onBlur={onBlur}
              />
            </div>
          );
          break;
        case 'checkbox':
          controlEl = (
            <div>
              <input type="checkbox"
                checked={!disabled ? value : ''}
                name={name}
                onChange={onChange} />
            </div>
          );
          break;
        default:
          controlEl = null;
      }
    }

    var className = 'property';
    if (props.canDrop) {
      className += ' can-drop';
    }
    if (props.firstChild) {
      className += ' first-child';
    }
    if (extraEl) {
      extraEl = (<div className="extra">{extraEl}</div>);
    }

    return (
      <div className={className}>
        {labelEl}
        <div className="control">
          {scaleEl}
          {controlEl}
        </div>
        {extraEl}
      </div>
    );
  }
});

module.exports = connect(mapStateToProps, mapDispatchToProps)(Property);
