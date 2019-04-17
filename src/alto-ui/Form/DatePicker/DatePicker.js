import React from 'react';
import PropTypes from 'prop-types';
import DayPicker, { LocaleUtils } from 'react-day-picker';
import 'react-day-picker/lib/style.css';
import { DateTime } from 'luxon';
import classnames from 'classnames';

import TextField from '../TextField';
import VisuallyHidden from '../../VisuallyHidden';
import DatePickerHeader from './DatePickerHeader';
import Popover from '../../Popover';

import './DatePicker.scss';

const renderDay = datePickerId => date => (
  <button
    id={`${datePickerId}__day--${date.getTime()}`}
    tabIndex="-1"
    className="DayPicker__a11y-day-button"
  >
    <span aria-hidden="true">{date.getDate()}</span>
    <VisuallyHidden>
      {DateTime.fromJSDate(date).toLocaleString(DateTime.DATE_HUGE)}, button
    </VisuallyHidden>
  </button>
);

class DatePicker extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      open: false,
      month: this.getDate() || DateTime.local(),
      value: null,
    };

    this.handleFocus = this.handleFocus.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
    this.handleClose = this.handleClose.bind(this);
    this.handleChangeMonth = this.handleChangeMonth.bind(this);
    this.handleChangeInput = this.handleChangeInput.bind(this);

    this.inputRef = React.createRef();
  }

  getDate(value) {
    const dateToParse = value || this.props.value;
    // iso or timestamp ?
    const date =
      ['number', 'string'].includes(typeof dateToParse) && dateToParse
        ? new Date(dateToParse)
        : dateToParse;
    return date ? DateTime.fromJSDate(date) : null;
  }

  getInputRef() {
    return this.props.inputRef || this.inputRef;
  }

  setDate(date) {
    const { timestamp, iso, onChange } = this.props;
    if (timestamp) onChange(date.getTime());
    else if (iso) onChange(date.toISOString());
    else onChange(date);
  }

  handleFocus(e) {
    if (this.props.readOnly) return;
    if (this.props.inputProps.onFocus) {
      this.props.inputProps.onFocus(e);
    }

    this.setState({ open: true });
  }

  handleBlur(e) {
    const { value } = this.state;
    const { format } = this.props;

    if (!value) return null;

    if (this.props.inputProps.onBlur) {
      this.props.inputProps.onBlur(e);
    }

    const date = DateTime.fromFormat(value, format);

    if (date.isValid) {
      this.setState({ value: null, month: date });
      this.setDate(date.toJSDate());
    } else {
      this.setState({ value: null });
      this.setDate('');
    }

    return this.setState({ open: false });
  }

  handleClose() {
    if (this.props.onClose) {
      this.props.onClose();
    }
    this.setState({ open: false });
  }

  handleChangeMonth(obj) {
    this.setState(({ month }) => ({ month: month.set(obj) }));
  }

  handleChangeInput(e) {
    this.setState({ value: e.target.value });
  }

  formatTextfieldDate(value) {
    // const { open } = this.state; // Uncomment when we enhance for typing in datefield
    const { format, displayFormat } = this.props;

    const date = this.getDate(value);

    if (!date) return '';
    // if (open) return date.toFormat(format); // Uncomment when we enhance for typing in datefield

    return date.toFormat(displayFormat || format);
  }

  render() {
    const { id, small, large, placeholder } = this.props;
    const { open, value } = this.state;
    const date = this.getDate();

    return (
      <div className={classnames('DatePicker', this.props.className)}>
        <TextField
          ref={this.getInputRef()}
          placeholder={placeholder}
          label={this.props.label}
          hideLabel={this.props.hideLabel}
          {...this.props.inputProps}
          readOnly={this.props.readOnly}
          onFocus={this.handleFocus}
          onChange={this.handleChangeInput}
          onBlur={this.handleBlur}
          value={value || this.formatTextfieldDate()}
          id={`${id}__input`}
          small={small}
          large={large}
        />
        <Popover
          className="DatePicker__day-picker"
          onClose={this.handleClose}
          open={open}
          start
          targetRef={this.getInputRef()}
          includeTarget
        >
          <DatePickerHeader date={this.state.month} id={id} onChange={this.handleChangeMonth} />
          <DayPicker
            month={this.state.month.toJSDate()}
            canChangeMonth={false}
            captionElement={() => null}
            onDayClick={d => {
              this.setDate(d);
              this.setState({ open: false });
            }}
            localeUtils={{ ...LocaleUtils, formatDay: () => '' }}
            selectedDays={date ? date.toJSDate() : null}
            renderDay={renderDay(id)}
          />
        </Popover>
      </div>
    );
  }
}

DatePicker.displayName = 'DatePicker';

DatePicker.defaultProps = {
  inputProps: {},
  format: 'dd/MM/yyyy',
  placeholder: '',
  displayFormat: 'dd LLL yyyy',
};

DatePicker.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  className: PropTypes.string,
  children: PropTypes.any,
  format: PropTypes.string,
  placeholder: PropTypes.string,
  displayFormat: PropTypes.string,
  readOnly: PropTypes.bool,
  onChange: PropTypes.func.isRequired,
  timestamp: PropTypes.bool,
  iso: PropTypes.bool,
  value: PropTypes.oneOfType([
    // iso
    PropTypes.string,
    // timestamp
    PropTypes.number,
    // date
    PropTypes.object,
  ]),
  inputProps: PropTypes.shape({
    onBlur: PropTypes.func,
    onFocus: PropTypes.func,
  }),
  inputRef: PropTypes.object,
  onClose: PropTypes.func,
  hideLabel: PropTypes.bool,
  small: PropTypes.bool,
  large: PropTypes.bool,
};

export default React.forwardRef((props, ref) => <DatePicker inputRef={ref} {...props} />);
