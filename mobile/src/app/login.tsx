import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SendOtpInput, VerifyOtpInput } from "@/shared/contracts/auth";
import { formatPhone } from "@/shared/phone";
import { authApi } from "~/api/auth";
import { ApiError } from "~/api/client";
import { useAuth } from "~/auth/AuthProvider";
import { ServerSetting } from "~/components/ServerSetting";
import { Button, TextField, errorMessage } from "~/components/ui";
import { useLightStatusBar } from "~/lib/status-bar";
import { colors, font, radius, space } from "~/theme";

/** Matches RATE_LIMITS.otpSendPerPhoneMinute on the server: one code a minute. */
const RESEND_SECONDS = 60;
const CODE_LENGTH = 6;

/**
 * Phone OTP sign-in, the only login method (see src/server/services/auth.service.ts).
 * Validation runs on the same zod contracts the API uses, so the phone number
 * is normalised to +91XXXXXXXXXX before it is sent.
 */
export default function LoginScreen() {
  useLightStatusBar();
  const { signIn } = useAuth();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [e164, setE164] = useState("");
  const [devCode, setDevCode] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  async function sendCode() {
    const parsed = SendOtpInput.safeParse({ phone });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a valid mobile number");
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const result = await authApi.sendOtp(parsed.data.phone);
      setE164(parsed.data.phone);
      setDevCode(result.devCode);
      // Without SMS the server hands the code back; fill it in for the user.
      setCode(result.devCode ?? "");
      setStep("code");
      setResendIn(RESEND_SECONDS);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    const parsed = VerifyOtpInput.safeParse({ phone: e164, code, name: name.trim() || undefined });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the code and try again");
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await signIn(parsed.data);
      // The root layout's guard swaps to the tabs once status flips to signedIn.
    } catch (err) {
      setError(err instanceof ApiError ? err.fieldErrors.code ?? err.message : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function changeNumber() {
    setStep("phone");
    setCode("");
    setError(undefined);
  }

  const phoneDigits = phone.replace(/\D/g, "");

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAwareScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        // Keep the primary button in view above the keyboard, not just the input.
        bottomOffset={step === "phone" ? 96 : 72}
        bounces={false}
      >
        <View style={styles.hero}>
          <View style={styles.logo}>
            <Ionicons name="home" size={28} color={colors.white} />
          </View>
          <Text style={styles.brand}>Gharr</Text>
          <Text style={styles.tagline}>Materials and labour for your home, in one app.</Text>
        </View>

        <SafeAreaView edges={["bottom"]} style={styles.sheet}>
          {step === "phone" ? (
            <>
              <Text style={styles.heading}>Sign in or create an account</Text>
              <Text style={[styles.sub, { marginBottom: space.lg }]}>We’ll text a 6-digit code to your mobile. No password needed.</Text>
              <TextField
                label="Mobile number"
                prefix="+91"
                placeholder="98765 43210"
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                returnKeyType="done"
                maxLength={10}
                value={phoneDigits}
                onChangeText={(value) => {
                  setPhone(value.replace(/\D/g, ""));
                  if (error) setError(undefined);
                }}
                error={error}
                onSubmitEditing={sendCode}
                inputStyle={styles.phoneText}
              />
              <Button title="Get OTP" onPress={sendCode} loading={busy} disabled={phoneDigits.length < 10} />
            </>
          ) : (
            <>
              <Text style={styles.heading}>Enter the code</Text>
              <View style={styles.sentRow}>
                <Text style={styles.sub}>Sent to {formatPhone(e164)} · </Text>
                <Pressable onPress={changeNumber} hitSlop={8}>
                  <Text style={styles.link}>Change</Text>
                </Pressable>
              </View>

              {devCode ? (
                <Pressable style={styles.devCode} onPress={() => setCode(devCode)}>
                  <Ionicons name="chatbox-ellipses-outline" size={22} color={colors.brand700} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.devCodeLabel}>Your OTP (SMS isn’t set up yet)</Text>
                    <Text style={styles.devCodeValue}>{devCode}</Text>
                  </View>
                  {code !== devCode ? <Text style={styles.link}>Fill</Text> : null}
                </Pressable>
              ) : null}

              <TextField
                label="6-digit code"
                placeholder="••••••"
                keyboardType="number-pad"
                autoComplete="sms-otp"
                textContentType="oneTimeCode"
                autoFocus
                maxLength={CODE_LENGTH}
                value={code}
                onChangeText={(value) => {
                  setCode(value.replace(/\D/g, ""));
                  if (error) setError(undefined);
                }}
                error={error}
                returnKeyType="done"
                onSubmitEditing={verify}
                inputStyle={styles.codeText}
              />
              <TextField
                label="Your name"
                hint="Only needed the first time you sign in"
                placeholder="e.g. Priya Sharma"
                autoCapitalize="words"
                autoComplete="name"
                returnKeyType="go"
                value={name}
                onChangeText={setName}
                onSubmitEditing={verify}
              />
              <Button title="Verify and continue" onPress={verify} loading={busy} disabled={code.length < CODE_LENGTH} />

              <View style={styles.resend}>
                {resendIn > 0 ? (
                  <Text style={styles.muted}>Resend code in 0:{String(resendIn).padStart(2, "0")}</Text>
                ) : (
                  <Pressable onPress={sendCode} disabled={busy} hitSlop={8}>
                    <Text style={styles.link}>Resend code</Text>
                  </Pressable>
                )}
              </View>
            </>
          )}
          <Text style={styles.terms}>By continuing you agree to Gharr’s terms and privacy policy.</Text>
          <ServerSetting />
        </SafeAreaView>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink900 },
  content: { flexGrow: 1 },
  hero: { flexGrow: 1, justifyContent: "flex-end", padding: space.xl, paddingTop: space.xxl, minHeight: 200 },
  logo: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.brand500,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.lg,
  },
  brand: { color: colors.white, fontSize: 34, fontWeight: "800", letterSpacing: -0.5 },
  tagline: { color: colors.ink200, fontSize: font.md, marginTop: space.xs, lineHeight: 22 },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
    paddingBottom: space.lg,
  },
  heading: { fontSize: font.xl, fontWeight: "700", color: colors.ink900 },
  sub: { fontSize: font.sm, color: colors.ink500, marginTop: space.xs, lineHeight: 20 },
  sentRow: { flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", marginBottom: space.lg },
  link: { color: colors.brand600, fontWeight: "700", fontSize: font.sm },
  muted: { color: colors.ink500, fontSize: font.sm },
  phoneText: { fontSize: font.lg, letterSpacing: 1 },
  codeText: { fontSize: 24, letterSpacing: 10, fontWeight: "700", textAlign: "center" },
  devCode: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.brand50,
    borderWidth: 1,
    borderColor: colors.brand100,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.lg,
  },
  devCodeLabel: { color: colors.brand700, fontSize: font.xs, fontWeight: "600" },
  devCodeValue: { color: colors.ink900, fontSize: font.xl, fontWeight: "800", letterSpacing: 4, marginTop: 2 },
  resend: { alignItems: "center", marginTop: space.lg },
  terms: { color: colors.ink400, fontSize: font.xs, textAlign: "center", marginTop: space.xl },
});
