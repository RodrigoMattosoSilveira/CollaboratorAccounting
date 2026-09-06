import type { FormEvent } from "react";
import type { CreateGoldPriceInput } from "../../types/goldPrices";
import { useTranslation } from "react-i18next";

type GoldPriceFormProps = {
  value: CreateGoldPriceInput;
  isPending?: boolean;
  onChange: (value: CreateGoldPriceInput) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function GoldPriceForm({ value, isPending = false, onChange, onSubmit }: GoldPriceFormProps) {
  const { t } = useTranslation("goldPrices");
  return (
    <form className="rounded-2xl border bg-white p-4 shadow-sm" onSubmit={onSubmit}>
      <h2 className="text-lg font-semibold text-gray-950">{t("recordGoldPrice")}</h2>
      <p className="mt-1 text-sm text-gray-500">
        {t("administratorRecordedBrlPer")}</p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="block text-sm font-semibold text-gray-700">
          {t("priceDateLabel")}<input
            className="mt-2 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
            required
            type="date"
            value={value.priceDate}
            onChange={(event) => onChange({ ...value, priceDate: event.target.value })}
          />
        </label>

        <label className="block text-sm font-semibold text-gray-700">
          {t("brlPerGram")}<input
            className="mt-2 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
            inputMode="decimal"
            min="0.01"
            required
            step="0.01"
            type="number"
            value={Number.isFinite(value.brlPerGram) && value.brlPerGram > 0 ? value.brlPerGram : ""}
            onChange={(event) => onChange({ ...value, brlPerGram: Number(event.target.value) })}
          />
        </label>

        <label className="block text-sm font-semibold text-gray-700">
          {t("recorded")}<input
            className="mt-2 block w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700"
            readOnly
            required
            value={value.recordedBy}
            placeholder={t("loading")}
          />
          <span className="mt-1 block text-xs font-normal text-gray-500">
            {t("derivedFromAuthenticatedSession")}</span>
        </label>

        <label className="block text-sm font-semibold text-gray-700 md:col-span-2">
          {t("notes")}<textarea
            className="mt-2 block min-h-24 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
            value={value.notes ?? ""}
            onChange={(event) => onChange({ ...value, notes: event.target.value })}
          />
        </label>
      </div>

      <button
        className="mt-4 rounded-xl bg-gray-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending ? t("recording") : t("recordGoldPrice")}
      </button>
    </form>
  );
}
