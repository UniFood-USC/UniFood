import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { adminServices } from '../../functions/src/firebase';
import { seedDemo } from '../../scripts/seed';

before(async () => { assert.equal(process.env.GCLOUD_PROJECT, 'demo-unifood'); await seedDemo(); });

test('demo: pedidos de ejemplo guardados con la forma de Order y el restaurante asociado a su cuenta', async () => {
  const { db } = adminServices();
  const orders = (await db.collection('orders').get()).docs.map(doc => ({ id: doc.id, ...doc.data() } as Record<string, unknown>));
  const own = orders.filter(order => order.studentId === 'demo-student');
  assert.ok(own.length >= 5, 'el estudiante demo tiene pedidos');
  assert.deepEqual([...new Set(own.map(order => order.status))].sort(), ['cancelled', 'collected', 'delivered', 'preparing', 'ready', 'received']);
  for (const order of own) {
    for (const field of ['studentId', 'restaurantId', 'mode', 'status', 'paymentMethod', 'total', 'paid', 'version', 'statusHistory', 'createdAt', 'updatedAt']) {
      assert.ok(field in order, `${order.id} sin ${field}`);
    }
  }
  assert.ok(own.some(order => order.paymentMethod === 'cash' && order.paid === false), 'hay un efectivo pendiente');
  assert.ok(orders.some(order => order.restaurantId !== 'rest-burger'), 'hay pedidos de otro restaurante');
  assert.equal((await db.doc('users/demo-restaurant').get()).data()?.restaurantId, 'rest-burger');
});
