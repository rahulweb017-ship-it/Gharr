import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CAN_CHANGE_SERVER, getApiBaseUrl, normaliseServerInput, setApiBaseUrl } from "~/config";
import { colors, font, space } from "~/theme";
import { Button, TextField } from "./ui";

const CHECK_TIMEOUT_MS = 8_000;

/** True if a Gharr API answers at `baseUrl`. */
async function isReachable(baseUrl: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl}/api/v1/categories`, {
      headers: { "x-gharr-client": "mobile" },
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Dev builds talk to a backend on a PC whose LAN IP changes with the network.
 * This lets the tester point the app at the new address instead of rebuilding
 * the APK. Hidden entirely on HTTPS (real) builds.
 */
export function ServerSetting() {
  const [current, setCurrent] = useState(getApiBaseUrl);
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [checking, setChecking] = useState(false);

  if (!CAN_CHANGE_SERVER) return null;

  async function save() {
    const url = normaliseServerInput(input);
    if (!url) {
      setError("Enter an address like 192.168.1.20 or 192.168.1.20:3100");
      return;
    }
    setChecking(true);
    setError(undefined);
    const ok = await isReachable(url);
    setChecking(false);
    if (!ok) {
      setError(`No Gharr server answered at ${url}. Is it running, and is the phone on the same network?`);
      return;
    }
    await setApiBaseUrl(url);
    setCurrent(url);
    setEditing(false);
  }

  if (!editing) {
    return (
      <View style={styles.row}>
        <Text style={styles.text}>Server: {current}</Text>
        <Pressable
          hitSlop={10}
          onPress={() => {
            setInput(current.replace(/^http:\/\//, ""));
            setError(undefined);
            setEditing(true);
          }}
        >
          <Text style={styles.link}>Change</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.editor}>
      <TextField
        label="Server address (the PC's IP from ipconfig)"
        value={input}
        onChangeText={setInput}
        placeholder="192.168.1.20:3100"
        keyboardType="url"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={save}
        error={error}
      />
      <View style={styles.actions}>
        <Button title="Cancel" variant="ghost" onPress={() => setEditing(false)} style={{ flex: 1 }} />
        <Button title="Test and save" variant="secondary" onPress={save} loading={checking} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "center", alignItems: "baseline", gap: space.sm, marginTop: space.sm },
  text: { color: colors.ink400, fontSize: font.xs },
  link: { color: colors.brand600, fontSize: font.xs, fontWeight: "700" },
  editor: { marginTop: space.lg, paddingTop: space.lg, borderTopWidth: 1, borderTopColor: colors.ink100 },
  actions: { flexDirection: "row", gap: space.md },
});
