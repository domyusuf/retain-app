import { useAppDispatch, useAppSelector } from '../store';
import { updateFilters } from '../store/filtersSlice';
export function MonthPicker({ disabled = false }: { disabled?: boolean }) {
  const dispatch = useAppDispatch();
  const month = useAppSelector((state) => state.filters.month);
  return (
    <label className="month-picker">
      <span>Month</span>
      <input
        disabled={disabled}
        type="month"
        min="1900-01"
        max="9999-12"
        aria-label="Selected month"
        value={month}
        onInput={(event) => {
          if (/^(19\d{2}|[2-9]\d{3})-(0[1-9]|1[0-2])$/.test(event.currentTarget.value))
            dispatch(updateFilters({ month: event.currentTarget.value }));
        }}
        onChange={(event) => {
          if (/^(19\d{2}|[2-9]\d{3})-(0[1-9]|1[0-2])$/.test(event.target.value))
            dispatch(updateFilters({ month: event.target.value }));
        }}
      />
    </label>
  );
}
