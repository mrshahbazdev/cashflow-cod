import { redirect, type LoaderFunctionArgs } from '@remix-run/node';
import { Form, useLoaderData } from '@remix-run/react';
import { login } from '../../shopify.server';
import styles from './styles.module.css';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  if (url.searchParams.get('shop')) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }
  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>Cashflow COD</h1>
        <p className={styles.text}>
          The most advanced Cash-on-Delivery order form app for Shopify — built for high-RTO markets
          (PK, IN, MENA, SEA).
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input
                className={styles.input}
                type="text"
                name="shop"
                placeholder="your-store.myshopify.com"
              />
              <span>e.g: my-shop-domain.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              Log in
            </button>
          </Form>
        )}
        <ul className={styles.list}>
          <li>
            <strong>1-click COD form</strong>. Popup, embedded, or slide-over — optimized for
            conversions in high-RTO markets.
          </li>
          <li>
            <strong>AI RTO-risk scoring</strong>. Every order scored 0–100 so you ship only genuine
            buyers.
          </li>
          <li>
            <strong>Courier + ops in one place</strong>. Postex, Leopards, TCS, Trax, and global
            carriers — plus agent call-center workflow.
          </li>
        </ul>
      </div>
    </div>
  );
}
