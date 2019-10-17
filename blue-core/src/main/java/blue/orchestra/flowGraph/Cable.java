package blue.orchestra.flowGraph;

public class Cable {

    private GraphUnit send;

    int sendPortIndex;

    private GraphUnit receive;

    int receivePortIndex;

    int receiveConnectionIndex;

    public Cable(GraphUnit send, int sendPortIndex, GraphUnit receive,
            int receivePortIndex, int receiveConnectionIndex) {
        this.send = send;
        this.sendPortIndex = sendPortIndex;

        this.receive = receive;
        this.receivePortIndex = receivePortIndex;
        this.receiveConnectionIndex = receiveConnectionIndex;
    }

    public GraphUnit getsendUnit() {
        return send;
    }

    public GraphUnit getToUnit() {
        return receive;
    }

    public void updateReceiveConnectionIndex(int index) {
        this.receiveConnectionIndex = index;
    }
}
