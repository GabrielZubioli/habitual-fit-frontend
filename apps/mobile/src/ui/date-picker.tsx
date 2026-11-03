import { useState } from "react";
import { Modal, Pressable, View } from "react-native";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { __iconNode as calendarDays } from "lucide-react/dist/esm/icons/calendar-days.js";
import { __iconNode as chevronDown } from "lucide-react/dist/esm/icons/chevron-down.js";
import { __iconNode as chevronLeft } from "lucide-react/dist/esm/icons/chevron-left.js";
import { __iconNode as chevronRight } from "lucide-react/dist/esm/icons/chevron-right.js";
import { formatDate, fromISODate, toISODate, todayISO } from "@forja/app-core/lib/date";
import { cn } from "@/lib/cn";
import { useColor } from "@/theme/theme";
import { Icon } from "./icon";
import { Text } from "./text";

/**
 * O seletor de data do app — o `date-picker.tsx` do web: o botão com a data e,
 * ao tocar, o calendário do mês num cartão, com "Hoje" embaixo.
 */
export function DatePicker({
  value,
  onChange,
  min,
  max,
  simples = false,
  className,
  accessibilityLabel,
}: {
  /** `YYYY-MM-DD`, ou vazio. */
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
  /** Só o texto ("Hoje", "sáb, 10 de out") com uma seta: para cabeçalhos. */
  simples?: boolean;
  className?: string;
  accessibilityLabel?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const hoje = todayISO();
  const primaria = useColor("primary");
  const apagada = useColor("muted-foreground");
  const rotuloTexto = simples && value === hoje ? "Hoje" : value ? rotulo(value) : "Escolher data";

  return (
    <>
      <Pressable
        onPress={() => setAberto(true)}
        accessibilityLabel={accessibilityLabel}
        className={cn(
          "flex-row items-center gap-2",
          !simples && "h-10 rounded-md border border-input bg-background px-3",
          className,
        )}
      >
        {!simples ? <Icon node={calendarDays} color={primaria} size={16} /> : null}
        <Text
          className={cn(
            simples ? "text-base text-muted-foreground" : "flex-1 text-base",
            !value && "text-muted-foreground",
          )}
        >
          {rotuloTexto.charAt(0).toUpperCase() + rotuloTexto.slice(1)}
        </Text>
        {simples ? <Icon node={chevronDown} color={apagada} size={16} /> : null}
      </Pressable>
      {aberto ? (
        <Calendario
          value={value}
          min={min}
          max={max}
          onClose={() => setAberto(false)}
          onPick={(iso) => {
            onChange(iso);
            setAberto(false);
          }}
        />
      ) : null}
    </>
  );
}

/** "sáb., 10 de out." — com o ano só quando não é o corrente. */
function rotulo(iso: string): string {
  const mesmoAno = iso.slice(0, 4) === todayISO().slice(0, 4);
  return formatDate(iso, mesmoAno ? "EEE, d 'de' MMM" : "d 'de' MMM 'de' yyyy");
}

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function Calendario({
  value,
  min,
  max,
  onClose,
  onPick,
}: {
  value: string;
  min?: string;
  max?: string;
  onClose: () => void;
  onPick: (iso: string) => void;
}) {
  const hoje = todayISO();
  const [mes, setMes] = useState(() => startOfMonth(value ? fromISODate(value) : new Date()));
  const texto = useColor("foreground");
  const permitido = (iso: string) => (!min || iso >= min) && (!max || iso <= max);
  const inicio = startOfWeek(mes);
  const fim = endOfWeek(endOfMonth(mes));
  const dias: Date[] = [];
  for (let d = inicio; d <= fim; d = addDays(d, 1)) dias.push(d);
  const titulo = formatDate(mes, "MMMM 'de' yyyy");

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable className="flex-1 items-center justify-center bg-black/60 px-6" onPress={onClose}>
        <Pressable
          onPress={() => undefined}
          className="w-full max-w-sm rounded-[20px] border border-border bg-card p-3"
        >
          <View className="mb-2 flex-row items-center justify-between px-1">
            <Pressable
              onPress={() => setMes((m) => addMonths(m, -1))}
              accessibilityLabel="Mês anterior"
              className="h-9 w-9 items-center justify-center rounded-full active:bg-elevated"
            >
              <Icon node={chevronLeft} color={texto} size={18} />
            </Pressable>
            <Text className="text-base font-semibold">
              {titulo.charAt(0).toUpperCase() + titulo.slice(1)}
            </Text>
            <Pressable
              onPress={() => setMes((m) => addMonths(m, 1))}
              accessibilityLabel="Próximo mês"
              className="h-9 w-9 items-center justify-center rounded-full active:bg-elevated"
            >
              <Icon node={chevronRight} color={texto} size={18} />
            </Pressable>
          </View>
          <View className="flex-row">
            {DIAS.map((d) => (
              <Text
                key={d}
                className="flex-1 text-center text-xs font-medium uppercase text-muted-foreground"
              >
                {d}
              </Text>
            ))}
          </View>
          <View className="mt-1 flex-row flex-wrap">
            {dias.map((d) => {
              const iso = toISODate(d);
              const escolhido = iso === value;
              const ok = permitido(iso);
              return (
                <View key={iso} className="w-[14.28%] p-0.5">
                  {isSameMonth(d, mes) ? (
                    <Pressable
                      disabled={!ok}
                      onPress={() => onPick(iso)}
                      accessibilityLabel={`${iso === hoje ? "Hoje, " : ""}${formatDate(iso, "EEEE, d 'de' MMMM 'de' yyyy")}${escolhido ? ", escolhido" : ""}`}
                      className={cn(
                        "aspect-square items-center justify-center rounded-full active:bg-elevated",
                        escolhido && "bg-primary",
                        !ok && "opacity-30",
                      )}
                    >
                      <Text
                        className={cn(
                          "text-sm",
                          escolhido
                            ? "font-bold text-primary-foreground"
                            : iso === hoje
                              ? "font-bold text-primary"
                              : "",
                        )}
                      >
                        {d.getDate()}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>
          {permitido(hoje) && value !== hoje ? (
            <Pressable
              onPress={() => onPick(hoje)}
              className="mt-1 items-center rounded-xl py-2.5 active:bg-elevated"
            >
              <Text className="text-sm font-semibold text-primary">Hoje</Text>
            </Pressable>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
