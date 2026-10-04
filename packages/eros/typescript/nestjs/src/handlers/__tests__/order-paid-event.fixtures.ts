class OrderPaidEvent {
  public readonly orderId: string;

  public constructor(orderId: string) {
    this.orderId = orderId;
  }
}

export { OrderPaidEvent };
