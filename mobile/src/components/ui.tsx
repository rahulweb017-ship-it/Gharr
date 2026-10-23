import { useState, type ComponentProps, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { formatINR } from "@/shared/money";
import { ApiError } from "~/api/client";
import { colors, font, radius, space } from "~/theme";

/**
 * The small set of primitives every screen is built from. They follow the web
 * app's components/ui vocabulary (Button, Card, Price, EmptyState) so a screen
 * ported from the web reads the same way.
 */

export type IconName = ComponentProps<typeof Ionicons>["name"];

/** Space kept between a focused input and the top of the keyboard. */
export const KEYBOARD_GAP = 24;

export function Screen({
  children,
  scroll = true,
  style,
}: {
  children: ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  if (!scroll) return <View style={[styles.screen, styles.screenPad, style]}>{children}</View>;
  // Android draws edge-to-edge, so the window no longer resizes for the
  // keyboard; this scrolls the focused input clear of it instead.
  return (
    <KeyboardAwareScrollView
      style={styles.screen}
      contentContainerStyle={[styles.screenPad, style]}
      keyboardShouldPersistTaps="handled"
      bottomOffset={KEYBOARD_GAP}
    >
      {children}
    </KeyboardAwareScrollView>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  icon,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  const palette = BUTTON_PALETTE[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.bg, borderColor: palette.border },
        pressed && { opacity: 0.85 },
        inactive && { opacity: 0.55 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <Ionicons name={icon} size={18} color={palette.fg} style={{ marginRight: space.sm }} /> : null}
          <Text style={[styles.buttonText, { color: palette.fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const BUTTON_PALETTE: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.brand500, fg: colors.white, border: colors.brand500 },
  secondary: { bg: colors.white, fg: colors.ink900, border: colors.ink200 },
  ghost: { bg: "transparent", fg: colors.brand600, border: "transparent" },
  danger: { bg: colors.white, fg: colors.danger600, border: colors.danger600 },
};

export function TextField({
  label,
  error,
  hint,
  prefix,
  style,
  inputStyle,
  multiline,
  onFocus,
  onBlur,
  ...input
}: TextInputProps & {
  label: string;
  error?: string;
  hint?: string;
  /** Fixed text shown inside the box before the value, e.g. "+91". */
  prefix?: string;
  inputStyle?: TextInputProps["style"];
}) {
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.danger600 : focused ? colors.brand500 : colors.ink200;
  return (
    <View style={[{ marginBottom: space.lg }, style as StyleProp<ViewStyle>]}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputBox, { borderColor }, focused && styles.inputFocused, multiline && styles.inputBoxMultiline]}>
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput
          placeholderTextColor={colors.ink300}
          accessibilityLabel={label}
          multiline={multiline}
          // Android centres multiline text vertically unless told otherwise.
          textAlignVertical={multiline ? "top" : "center"}
          {...input}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.inputText, multiline && styles.inputMultiline, inputStyle]}
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Card({
  children,
  onPress,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Price({ paise, style, strike = false }: { paise: number; style?: object; strike?: boolean }) {
  return (
    <Text style={[styles.price, strike && styles.strike, style]}>{formatINR(paise)}</Text>
  );
}

/** A label/amount line in a price breakdown. */
export function AmountRow({ label, paise, bold, zeroLabel }: { label: string; paise: number; bold?: boolean; zeroLabel?: string }) {
  const style = bold ? { fontWeight: "700" as const } : undefined;
  return (
    <View style={[styles.row, { justifyContent: "space-between", paddingVertical: 2 }]}>
      <Text style={[styles.body, style]}>{label}</Text>
      <Text style={[styles.body, style]}>{paise === 0 && zeroLabel ? zeroLabel : formatINR(paise)}</Text>
    </View>
  );
}

export function Badge({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "brand" | "trust" | "danger" }) {
  const palette = {
    neutral: { bg: colors.ink100, fg: colors.ink700 },
    brand: { bg: colors.brand100, fg: colors.brand700 },
    trust: { bg: colors.trust50, fg: colors.trust600 },
    danger: { bg: colors.danger50, fg: colors.danger600 },
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.badgeText, { color: palette.fg }]}>{label}</Text>
    </View>
  );
}

export function Title({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={[styles.title, style]}>{children}</Text>;
}

export function SectionTitle({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={[styles.sectionTitle, style]}>{children}</Text>;
}

export function Muted({ children, style, numberOfLines }: { children: ReactNode; style?: object; numberOfLines?: number }) {
  return (
    <Text style={[styles.muted, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

export function Body({ children, style, numberOfLines }: { children: ReactNode; style?: object; numberOfLines?: number }) {
  return (
    <Text style={[styles.body, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function Divider() {
  return <View style={styles.divider} />;
}

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.brand500} />
    </View>
  );
}

export function EmptyState({
  icon = "file-tray-outline",
  title,
  message,
  action,
}: {
  icon?: IconName;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.center}>
      <Ionicons name={icon} size={48} color={colors.ink300} />
      <Text style={[styles.sectionTitle, { marginTop: space.md, textAlign: "center" }]}>{title}</Text>
      {message ? <Text style={[styles.muted, { textAlign: "center", marginTop: space.xs }]}>{message}</Text> : null}
      {action ? <View style={{ marginTop: space.lg, alignSelf: "stretch" }}>{action}</View> : null}
    </View>
  );
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong";
}

export function ErrorView({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <EmptyState
      icon="cloud-offline-outline"
      title="Couldn't load this"
      message={errorMessage(error)}
      action={onRetry ? <Button title="Try again" variant="secondary" onPress={onRetry} /> : undefined}
    />
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !onPress }}
      onPress={onPress}
      style={[styles.chip, selected && { backgroundColor: colors.ink900, borderColor: colors.ink900 }]}
    >
      <Text style={[styles.chipText, selected && { color: colors.white }]}>{label}</Text>
    </Pressable>
  );
}

/**
 * Lays chips out with even spacing: one scrolling line (`scroll`), or wrapped
 * onto as many lines as they need.
 */
export function Chips({
  children,
  scroll = false,
  style,
  contentStyle,
}: {
  children: ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  if (scroll) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={[{ flexGrow: 0 }, style]}
        contentContainerStyle={[styles.chips, contentStyle]}
      >
        {children}
      </ScrollView>
    );
  }
  return <View style={[styles.chips, { flexWrap: "wrap" }, style, contentStyle]}>{children}</View>;
}

export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  format = (n: number) => String(n),
}: {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  format?: (value: number) => string;
}) {
  const round = (n: number) => Math.round(n * 1000) / 1000;
  return (
    <View style={styles.stepper}>
      <Pressable
        accessibilityLabel="Decrease"
        onPress={() => onChange(round(Math.max(min, value - step)))}
        style={styles.stepperButton}
        disabled={value - step < min}
      >
        <Ionicons name="remove" size={18} color={colors.ink900} />
      </Pressable>
      <Text style={styles.stepperValue}>{format(value)}</Text>
      <Pressable accessibilityLabel="Increase" onPress={() => onChange(round(value + step))} style={styles.stepperButton}>
        <Ionicons name="add" size={18} color={colors.ink900} />
      </Pressable>
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  screenPad: { padding: space.lg, paddingBottom: space.xxl },
  row: { flexDirection: "row", alignItems: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl, minHeight: 240 },
  button: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: space.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { fontSize: font.md, fontWeight: "600" },
  label: { fontSize: font.sm, fontWeight: "600", color: colors.ink700, marginBottom: space.xs },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.ink200,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    fontSize: font.md,
    color: colors.ink900,
    backgroundColor: colors.white,
  },
  inputBox: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    backgroundColor: colors.white,
  },
  inputFocused: { borderWidth: 2, paddingHorizontal: space.md - 1 },
  inputBoxMultiline: { alignItems: "flex-start", paddingVertical: space.sm },
  inputText: { flex: 1, minHeight: 48, fontSize: font.md, color: colors.ink900, paddingVertical: 0 },
  inputMultiline: { minHeight: 96, paddingTop: space.xs },
  prefix: { fontSize: font.md, fontWeight: "600", color: colors.ink700, marginRight: space.sm },
  error: { color: colors.danger600, fontSize: font.xs, marginTop: space.xs },
  hint: { color: colors.ink400, fontSize: font.xs, marginTop: space.xs },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.ink100,
    padding: space.lg,
    marginBottom: space.md,
  },
  price: { fontSize: font.md, fontWeight: "700", color: colors.ink900 },
  strike: { textDecorationLine: "line-through", color: colors.ink400, fontWeight: "400", fontSize: font.sm },
  badge: { borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2, alignSelf: "flex-start" },
  badgeText: { fontSize: font.xs, fontWeight: "600" },
  title: { fontSize: font.xl, fontWeight: "700", color: colors.ink900, marginBottom: space.sm },
  sectionTitle: { fontSize: font.lg, fontWeight: "700", color: colors.ink900, marginBottom: space.sm },
  body: { fontSize: font.md, color: colors.ink900 },
  muted: { fontSize: font.sm, color: colors.ink500 },
  divider: { height: 1, backgroundColor: colors.ink100, marginVertical: space.md },
  chip: {
    borderWidth: 1,
    borderColor: colors.ink200,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    minHeight: 36,
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  chips: { flexDirection: "row", alignItems: "center", gap: space.sm },
  chipText: { fontSize: font.sm, color: colors.ink700, fontWeight: "500" },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.ink200,
    borderRadius: radius.md,
    backgroundColor: colors.white,
  },
  stepperButton: { padding: space.sm, paddingHorizontal: space.md },
  stepperValue: { minWidth: 48, textAlign: "center", fontSize: font.md, fontWeight: "600", color: colors.ink900 },
});
