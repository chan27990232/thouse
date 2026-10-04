import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { cn } from './ui/utils';
import {
  PHONE_COUNTRY_OPTIONS,
  getPhoneCountryOption,
  normalizePhoneCountryCode,
  type PhoneCountryLabelKey,
} from '../lib/phoneCountryCode';

function RegionFlag({ iso2, alt }: { iso2: string; alt: string }) {
  return (
    <img
      src={`https://flagcdn.com/w40/${iso2}.png`}
      srcSet={`https://flagcdn.com/w80/${iso2}.png 2x`}
      alt={alt}
      width={20}
      height={15}
      className="h-[15px] w-5 shrink-0 rounded-[2px] object-cover shadow-[0_0_0_1px_rgba(0,0,0,0.08)]"
    />
  );
}

type PhoneCountryFieldProps = {
  countryCode: string;
  onCountryCodeChange?: (value: string) => void;
  phone: string;
  onPhoneChange?: (value: string) => void;
  phoneId: string;
  countryAriaLabel: string;
  phonePlaceholder?: string;
  optionLabel: (labelKey: PhoneCountryLabelKey) => string;
  readOnly?: boolean;
  className?: string;
};

export function PhoneCountryField({
  countryCode,
  onCountryCodeChange,
  phone,
  onPhoneChange,
  phoneId,
  countryAriaLabel,
  phonePlaceholder,
  optionLabel,
  readOnly = false,
  className,
}: PhoneCountryFieldProps) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const selected = getPhoneCountryOption(countryCode);

  return (
    <div
      className={cn(
        'flex h-12 w-full items-stretch overflow-hidden rounded-md border border-input bg-input-background',
        'transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50',
        readOnly && 'bg-gray-50 focus-within:border-input focus-within:ring-0',
        className,
      )}
    >
      <div className="relative flex w-[7.5rem] shrink-0 items-center border-r border-input/70">
        {selected ? (
          <span className="pointer-events-none absolute left-2.5 flex items-center">
            <RegionFlag iso2={selected.iso2} alt="" />
          </span>
        ) : null}
        <input
          type="text"
          inputMode="tel"
          autoComplete="tel-country-code"
          aria-label={countryAriaLabel}
          aria-controls={listId}
          aria-expanded={open}
          aria-autocomplete="list"
          placeholder="+852"
          value={countryCode}
          readOnly={readOnly}
          onChange={(e) => onCountryCodeChange?.(normalizePhoneCountryCode(e.target.value))}
          className={cn(
            'h-full w-full bg-transparent pr-7 text-sm tabular-nums outline-none md:text-sm',
            selected ? 'pl-9' : 'pl-3',
          )}
        />
        {readOnly ? null : (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={countryAriaLabel}
                className="absolute inset-y-0 right-0 flex w-7 items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              id={listId}
              className="w-72 p-1"
              align="start"
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <div className="max-h-64 overflow-y-auto">
                {PHONE_COUNTRY_OPTIONS.map(({ code, iso2, labelKey }) => {
                  const regionName = optionLabel(labelKey);
                  return (
                    <button
                      key={code}
                      type="button"
                      className={cn(
                        'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm',
                        'hover:bg-gray-100',
                        countryCode === code && 'bg-gray-100 font-medium',
                      )}
                      onClick={() => {
                        onCountryCodeChange?.(code);
                        setOpen(false);
                      }}
                    >
                      <span className="min-w-0 flex-1 truncate">{regionName}</span>
                      <RegionFlag iso2={iso2} alt={regionName} />
                      <span className="w-12 shrink-0 text-right tabular-nums text-gray-600">{code}</span>
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
      <input
        id={phoneId}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder={phonePlaceholder}
        value={phone}
        readOnly={readOnly}
        onChange={(e) => onPhoneChange?.(e.target.value)}
        className="h-full min-w-0 flex-1 bg-transparent px-3 text-base outline-none placeholder:text-muted-foreground md:text-sm"
      />
    </div>
  );
}
