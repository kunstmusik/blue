package blue.orchestra.flowGraph;

import java.util.Comparator;

class GraphUnitComparator implements Comparator<GraphUnit> {
    @Override
    public int compare(GraphUnit a, GraphUnit b) {

        double x1 = a.coordinate.x;
        double y1 = a.coordinate.y;

        double x2 = b.coordinate.x;
        double y2 = b.coordinate.y;

        if (y1 > y2) {
            return 1;
        } else if (y1 < y2) {
            return -1;
        } else if (x1 > x2) {
            return 1;
        } else if (x1 < x2) {
            return -1;
        }

        return 0;

    }

}