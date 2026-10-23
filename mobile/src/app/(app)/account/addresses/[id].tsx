import { useState } from "react";
import { Alert, Switch, Text, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AddressInput } from "@/shared/contracts/address";
import { addressApi, type Address } from "~/api/addresses";
import { ApiError } from "~/api/client";
import type { AddressType } from "~/api/types";
import { Button, Chip, Chips, Loading, Muted, Row, Screen, TextField, errorMessage } from "~/components/ui";
import { colors, space } from "~/theme";

type Form = Record<"contactName" | "contactPhone" | "line1" | "line2" | "landmark" | "city" | "state" | "pincode" | "gstin", string>;

const EMPTY: Form = { contactName: "", contactPhone: "", line1: "", line2: "", landmark: "", city: "", state: "", pincode: "", gstin: "" };
const TYPES: AddressType[] = ["HOME", "SITE", "OFFICE"];

function toForm(a: Address): Form {
  return {
    contactName: a.contactName,
    contactPhone: a.contactPhone.replace(/^\+91/, ""),
    line1: a.line1,
    line2: a.line2 ?? "",
    landmark: a.landmark ?? "",
    city: a.city,
    state: a.state,
    pincode: a.pincode,
    gstin: a.gstin ?? "",
  };
}

/** Create (id = "new") or edit an address. Validates with the API's own AddressInput contract. */
export default function AddressFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === "new";
  const addresses = useQuery({ queryKey: ["addresses"], queryFn: addressApi.list, enabled: !isNew });
  const existing = addresses.data?.find((a) => a.id === id);

  if (!isNew && addresses.isPending) return <Loading />;
  return <AddressForm key={existing?.id ?? "new"} existing={existing} />;
}

function AddressForm({ existing }: { existing?: Address }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Form>(existing ? toForm(existing) : EMPTY);
  const [type, setType] = useState<AddressType>(existing?.type ?? "HOME");
  const [isDefault, setIsDefault] = useState(existing?.isDefault ?? false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (key: keyof Form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const onDone = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["addresses"] }),
      queryClient.invalidateQueries({ queryKey: ["me"] }),
    ]);
    router.back();
  };
  const onError = (err: unknown) =>
    setErrors(err instanceof ApiError ? { ...err.fieldErrors, form: err.message } : { form: errorMessage(err) });

  const save = useMutation({
    mutationFn: (input: AddressInput) => (existing ? addressApi.update(existing.id, input) : addressApi.create(input)),
    onSuccess: onDone,
    onError,
  });
  const remove = useMutation({ mutationFn: () => addressApi.remove(existing!.id), onSuccess: onDone, onError });

  function submit() {
    const parsed = AddressInput.safeParse({ ...form, type, isDefault });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    save.mutate(parsed.data);
  }

  function confirmDelete() {
    Alert.alert("Delete this address?", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => remove.mutate() },
    ]);
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: existing ? "Edit address" : "New address" }} />
      <Chips style={{ marginBottom: space.lg }}>
        {TYPES.map((t) => (
          <Chip key={t} label={t[0] + t.slice(1).toLowerCase()} selected={type === t} onPress={() => setType(t)} />
        ))}
      </Chips>
      <TextField label="Contact name" value={form.contactName} onChangeText={set("contactName")} autoCapitalize="words" error={errors.contactName} />
      <TextField label="Contact phone" prefix="+91" value={form.contactPhone} onChangeText={set("contactPhone")} keyboardType="phone-pad" maxLength={10} error={errors.contactPhone} />
      <TextField label="House / flat / site" value={form.line1} onChangeText={set("line1")} error={errors.line1} />
      <TextField label="Street, area (optional)" value={form.line2} onChangeText={set("line2")} error={errors.line2} />
      <TextField label="Landmark (optional)" value={form.landmark} onChangeText={set("landmark")} error={errors.landmark} />
      <Row style={{ gap: space.md }}>
        <TextField label="City" value={form.city} onChangeText={set("city")} error={errors.city} style={{ flex: 1 }} />
        <TextField label="Pincode" value={form.pincode} onChangeText={set("pincode")} keyboardType="number-pad" maxLength={6} error={errors.pincode} style={{ flex: 1 }} />
      </Row>
      <TextField label="State" value={form.state} onChangeText={set("state")} error={errors.state} />
      <TextField label="GSTIN (optional, for business invoices)" value={form.gstin} onChangeText={set("gstin")} autoCapitalize="characters" error={errors.gstin} />

      {!existing?.isDefault ? (
        <Row style={{ justifyContent: "space-between", marginBottom: space.lg }}>
          <Text style={{ color: colors.ink900, fontSize: 16, flex: 1 }}>Make this my default address</Text>
          <Switch value={isDefault} onValueChange={setIsDefault} trackColor={{ true: colors.brand500 }} />
        </Row>
      ) : null}

      {errors.form ? <Muted style={{ color: colors.danger600, marginBottom: space.md }}>{errors.form}</Muted> : null}
      <Button title="Save address" onPress={submit} loading={save.isPending} />
      {existing ? (
        <View style={{ marginTop: space.md }}>
          <Button title="Delete address" variant="danger" onPress={confirmDelete} loading={remove.isPending} />
        </View>
      ) : null}
    </Screen>
  );
}
