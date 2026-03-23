import { redirect } from "next/navigation";

/**
 * Кошелёк заморожен (ранняя стадия): вкладка скрыта, `/wallet` редиректится в middleware.
 * Прежний клиентский UI сохранён в истории git до заморозки.
 */
export default function WalletPage() {
  redirect("/library");
}
