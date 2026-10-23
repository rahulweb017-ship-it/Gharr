import { useState } from "react";
import { router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ProfileUpdateInput } from "@/shared/contracts/address";
import { formatPhone } from "@/shared/phone";
import { authApi } from "~/api/auth";
import { ApiError } from "~/api/client";
import { useAuth } from "~/auth/AuthProvider";
import { Button, Muted, Screen, TextField, errorMessage } from "~/components/ui";
import { colors, space } from "~/theme";

export default function ProfileScreen() {
  const { user, reloadUser } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: (input: ProfileUpdateInput) => authApi.updateProfile(input),
    onSuccess: async (me) => {
      queryClient.setQueryData(["me"], me);
      await reloadUser();
      router.back();
    },
    onError: (err) => setErrors(err instanceof ApiError ? { ...err.fieldErrors, form: err.message } : { form: errorMessage(err) }),
  });

  function submit() {
    const parsed = ProfileUpdateInput.safeParse({ name: name.trim() || undefined, email: email.trim() });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    save.mutate(parsed.data);
  }

  return (
    <Screen>
      <TextField label="Name" value={name} onChangeText={setName} autoCapitalize="words" error={errors.name} />
      <TextField
        label="Email (optional)"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        error={errors.email}
      />
      <Muted style={{ marginBottom: space.lg }}>
        Mobile: {user ? formatPhone(user.phone) : ""}. Your number is your login and can’t be changed here.
      </Muted>
      {errors.form ? <Muted style={{ color: colors.danger600, marginBottom: space.md }}>{errors.form}</Muted> : null}
      <Button title="Save" onPress={submit} loading={save.isPending} />
    </Screen>
  );
}
