import React from 'react';

export default function SelectField({
  label,
  id,
  value,
  onChange,
  options,
  placeholder,
  required = false,
  error,
  ...rest
}) {
  return (
    <div className="mb-4 w-full text-left">
      <label htmlFor={id} className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      
      <div className="relative w-full">
        <select
          id={id}
          name={id}
          value={value}
          onChange={onChange}
          required={required}
          className={`w-full bg-white border text-slate-900 rounded-lg py-2.5 pl-3.5 pr-10 text-sm transition-all appearance-none focus:outline-none focus:border-accent focus:ring-3 focus:ring-accent/20 ${
            error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-200'
          }`}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          
          {options.map((opt, index) => {
            const val = typeof opt === 'object' ? opt.value : opt;
            const labelText = typeof opt === 'object' ? opt.label : opt;
            return (
              <option key={index} value={val}>
                {labelText}
              </option>
            );
          })}
        </select>
        
        {/* Custom Chevron SVG Arrow */}
        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
        </span>
      </div>
      
      {error && (
        <span className="text-xs text-red-500 mt-1 block">
          {error}
        </span>
      )}
    </div>
  );
}
