import React from 'react';

export default function PhoneInput({ value, onChange, ...inputProps }) {
  const handleChange = (event) => {
    let digits = event.target.value.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) {
      digits = digits.slice(2);
    } else if (digits.length === 11 && digits.startsWith('0')) {
      digits = digits.slice(1);
    }
    digits = digits.slice(0, 10);

    if (typeof onChange === 'function') {
      onChange(digits);
    }
  };

  return (
    <input
      {...inputProps}
      type="tel"
      inputMode="numeric"
      pattern="[6-9][0-9]{9}"
      minLength={10}
      maxLength={10}
      title="Enter a valid 10-digit Indian mobile number (e.g. 9876543210)."
      value={value ?? ''}
      onChange={handleChange}
    />
  );
}
