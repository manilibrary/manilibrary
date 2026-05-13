import { Suspense } from "react";
import UpdatePasswordForm from "./UpdatePasswordForm";

export const metadata = {
  title: "Set new password",
};

export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={null}>
      <UpdatePasswordForm />
    </Suspense>
  );
}
