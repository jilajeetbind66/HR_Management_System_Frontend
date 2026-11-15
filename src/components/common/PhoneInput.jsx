import React from 'react';

export default function PhoneInput({ value, onChange, ...inputProps }) {
  const handleChange = (event) => {
    const digits = event.target.value.replace(/\D/g, '').slice(0, 10);
    onChange?.(digits);
  };

  return (
    <input
      {...inputProps}
      type="tel"
      inputMode="numeric"
      pattern="[0-9]{10}"
      minLength={10}
      maxLength={10}
      title="Enter exactly 10 digits."
      value={value ?? ''}
      onChange={handleChange}
    />
  );
}
