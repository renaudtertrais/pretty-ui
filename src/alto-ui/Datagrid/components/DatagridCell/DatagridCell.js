import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import mathEvaluator from 'math-expression-evaluator';
import debounce from 'lodash.debounce';

import ExclamationCircleIcon from '../../../Icons/ExclamationCircle';
import ExclamationTriangleIcon from '../../../Icons/ExclamationTriangle';
import TextField from '../../../Form/TextField';
import Tooltip from '../../../Tooltip';

import { bemClass } from '../../../helpers/bem';

import './DatagridCell.scss';

const IDENTITY = x => x;

const evaluateFormula = (formula, row, errorLabel) => {
  const expression = Object.entries(row).reduce(
    (acc, [key, value]) => acc.replace(new RegExp(`\\[${key}\\]`, 'g'), value || 0),
    formula
  );

  try {
    const res = mathEvaluator.eval(expression);
    if (!Number.isFinite(res) || Number.isNaN(res)) return new Error(errorLabel);
    return res;
  } catch (e) {
    return new Error(errorLabel);
  }
};

const getValue = (value, column, row, labels) =>
  column.formula ? evaluateFormula(column.formula, row, labels.errorFormula) : value;
const getType = (value, column) => (value instanceof Error ? 'error' : column.type || typeof value);

const getFormattedValue = context => (value, column, row) => {
  const val = getValue(value, column, row, context.labels);
  const type = getType(val, column);
  const parser = context.parsers[type] || IDENTITY;
  const formatter = column.formatter || context.formatters[type] || IDENTITY;
  const args = [column, row, context];

  return formatter(parser(val, ...args), ...args);
};

const getInputProps = type => {
  switch (type) {
    case 'number':
    case 'float':
    case 'int':
    case 'integer':
    case 'percentage':
      return {
        type: 'number',
      };
    default:
      return {};
  }
};

class DatagridCell extends React.Component {
  constructor(props) {
    super(props);

    const value = props.row[props.column.key];

    this.state = {
      editing: false,
      width: 150,
      value,
      // eslint-disable-next-line react/no-unused-state
      originalValue: value,
    };

    const { onChangeDebounceTime } = props.context;

    this.startEditing = this.startEditing.bind(this);
    this.stopEditing = this.stopEditing.bind(this);
    this.handleChange = this.handleChange.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.format = this.format.bind(this);
    const propagateChange = this.propagateChange.bind(this);
    this.propagateChange = onChangeDebounceTime
      ? debounce(propagateChange, onChangeDebounceTime)
      : propagateChange;
    this.inputRef = React.createRef();
    this.cellRef = React.createRef();
  }

  static getDerivedStateFromProps(nextProps, prevState) {
    if (!nextProps.column.formula) {
      const nextValue = nextProps.row[nextProps.column.key || nextProps.column];
      if (nextValue !== prevState.originalValue) {
        return {
          value: nextValue,
          originalValue: nextValue,
        };
      }
    }
    return null;
  }

  componentDidUpdate(prevProps, prevState) {
    const becameEditing = !prevState.editing && this.state.editing;

    if (becameEditing) {
      this.focus();
    }
  }

  getValue() {
    const { row, column, context } = this.props;
    return getValue(this.state.value, column, row, context.labels);
  }

  getStyle() {
    const { column } = this.props;
    if (this.state.editing) {
      return { width: this.state.width, maxWidth: this.state.width };
    }
    if (column.width || column.width === 0) {
      return { width: column.width, maxWidth: column.width };
    }
    return {};
  }

  getModifiers() {
    const { editing } = this.state;
    const { context, row, column, edited, editable } = this.props;

    const value = this.getValue();
    const type = getType(value, column);

    return {
      [type]: true,
      formula: !!column.formula,
      editable,
      editing,
      edited,
      'with-icon': context.showError(value, column, row),
      ...context.modifiers(value, column, row),
    };
  }

  format(value, column, row) {
    const { context } = this.props;
    const format = getFormattedValue(context);
    return format(value, column, row);
  }

  replaceRowValues(message) {
    if (typeof message !== 'string') return message;
    const { row, context } = this.props;

    return context.columns.reduce(
      (acc, col) =>
        acc.replace(
          new RegExp(`\\{${col.key}\\}`, 'g'),
          this.format(row[col.key || col], col, row)
        ),
      message
    );
  }

  startEditing() {
    const width = this.cellRef.current.offsetWidth;
    this.setState({ editing: true, width });
  }
  stopEditing() {
    this.setState({ editing: false });
  }

  focus() {
    this.inputRef.current.focus();
  }

  handleChange(e) {
    const { value } = e.target;
    this.setState({ value });
    this.propagateChange(value);
  }

  handleBlur(e) {
    this.stopEditing();
    const { value } = e.target;
    const { column, row, context } = this.props;
    if (context.onBlur) {
      const error = context.showError(value, column, row);
      context.onBlur(value, column, row, this.replaceRowValues(error));
    }
  }

  propagateChange(value) {
    const { column, row, context } = this.props;
    if (context.onChange) {
      const error = context.showError(value, column, row);
      context.onChange(value, column, row, this.replaceRowValues(error));
    }
  }

  handleKeyDown(e) {
    if (e.key === 'Escape' || e.key === 'Esc' || e.key === 'Enter') {
      this.stopEditing();
    }
  }

  renderValue() {
    const { render, column, row, context } = this.props;
    const value = this.getValue();
    const type = getType(value, column);
    if (render) {
      const formatter = column.formatter || context.formatters[type] || IDENTITY;
      const format = x => formatter(x, column, row, context);
      return render(column, row, format);
    }
    const renderer = context.renderers[type] || IDENTITY;
    return renderer(this.format(this.state.value, column, row), column, row, context);
  }

  renderContent() {
    const { id, context, row, column, editable, rowIndex, colIndex } = this.props;
    const value = this.getValue();
    const modifiers = this.getModifiers();

    const ContentComponent = editable ? 'button' : 'div';

    const content = (
      <ContentComponent
        id={editable && id ? `${id}__button` : undefined}
        ref={this.setContentNode}
        className={bemClass('DatagridCell__content', modifiers)}
        onClick={editable ? this.startEditing : undefined}
      >
        {this.renderValue()}
      </ContentComponent>
    );

    const error =
      typeof context.showError === 'function' ? context.showError(value, column, row) : false;
    if (!error) return content;
    const warning =
      typeof context.isWarningError === 'function'
        ? context.isWarningError(value, column, row)
        : false;

    const icon = warning ? (
      <ExclamationTriangleIcon baseline className="DatagridCell__warning-icon" />
    ) : (
      <ExclamationCircleIcon baseline className="DatagridCell__error-icon" />
    );
    const lastRow = rowIndex === context.rows.length - 1;
    const firstCell = colIndex === 0;
    const lastCell = colIndex === context.columns.length - 1;
    const tooltipContent = this.replaceRowValues(error);
    const isMedium = tooltipContent.length > 35;
    const errorElement =
      typeof error === 'string' ? (
        <Tooltip
          content={tooltipContent}
          medium={isMedium}
          error={!warning}
          warning={warning}
          top={lastRow && !firstCell && !lastCell}
          left={lastCell}
          right={firstCell}
        >
          {icon}
        </Tooltip>
      ) : (
        icon
      );
    return (
      <Fragment>
        {errorElement}
        {content}
      </Fragment>
    );
  }

  render() {
    const { id, column, row, context, editable, rowIndex, colIndex } = this.props;
    const key = column.key || column;
    const value = getValue(this.state.value, column, row, context.labels);
    const type = getType(value, column);

    const style = this.getStyle();

    const modifiers = this.getModifiers();

    return (
      <div
        title={this.getValue()}
        className={bemClass('DatagridCell', modifiers)}
        ref={this.cellRef}
        style={style}
        role="gridcell"
        aria-rowindex={rowIndex}
        aria-colindex={colIndex}
      >
        <div className="DatagridCell__container">
          {this.renderContent()}
          {editable && (
            <TextField
              ref={this.inputRef}
              label="edit cell"
              hideLabel
              small={context.compact}
              id={id ? `${id}__input` : `DatagridCell__input--${row[context.rowId]}--${key}`}
              className={bemClass('DatagridCell__input', modifiers)}
              style={{ width: (column.width || this.state.width) - 6 }}
              value={value || ''}
              onChange={this.handleChange}
              onBlur={this.handleBlur}
              onKeyDown={this.handleKeyDown}
              {...getInputProps(type)}
            />
          )}
        </div>
      </div>
    );
  }
}

DatagridCell.displayName = 'DatagridCell';

DatagridCell.defaultProps = {
  editable: false,
  edited: false,
};

DatagridCell.propTypes = {
  id: PropTypes.string,
  column: PropTypes.shape({
    key: PropTypes.any.isRequired,
    title: PropTypes.any.isRequired,
    description: PropTypes.string,
    type: PropTypes.string,
    width: PropTypes.number,
    formula: PropTypes.string,
  }),
  row: PropTypes.object.isRequired,
  rowIndex: PropTypes.number.isRequired,
  colIndex: PropTypes.number.isRequired,
  context: PropTypes.shape({
    onChangeDebounceTime: PropTypes.number,
    onChange: PropTypes.func,
    renderers: PropTypes.object,
    formatters: PropTypes.object,
    parsers: PropTypes.object,
    labels: PropTypes.shape({
      errorFormula: PropTypes.string,
    }),
    locale: PropTypes.string,
  }),
  render: PropTypes.func,
  editable: PropTypes.bool,
  edited: PropTypes.bool,
};

export default DatagridCell;
