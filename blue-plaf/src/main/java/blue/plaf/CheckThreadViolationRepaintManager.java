package blue.plaf;

import javax.swing.JComponent;
import javax.swing.RepaintManager;
import javax.swing.SwingUtilities;

public class CheckThreadViolationRepaintManager extends RepaintManager {
     // it is recommended to pass the complete check
     private boolean completeCheck = true;

     public boolean isCompleteCheck() {
         return completeCheck;
     }

     public void setCompleteCheck(boolean completeCheck) {
         this.completeCheck = completeCheck;
     }

     @Override
     public synchronized void addInvalidComponent(JComponent component) {
         checkThreadViolations(component);
         super.addInvalidComponent(component);
     }

     @Override
     public void addDirtyRegion(JComponent component, int x, int y, int w, int 
h) {
         checkThreadViolations(component);
         super.addDirtyRegion(component, x, y, w, h);
     }

     private void checkThreadViolations(JComponent c) {
         if (!SwingUtilities.isEventDispatchThread() && (completeCheck || 
c.isShowing())) {
             Exception exception = new Exception();
             boolean repaint = false;
             boolean fromSwing = false;
             StackTraceElement[] stackTrace = exception.getStackTrace();
             for (StackTraceElement st : stackTrace) {
                 if (repaint && st.getClassName().startsWith("javax.swing.")) {
                     fromSwing = true;
                 }
                 if ("repaint".equals(st.getMethodName())) {
                     repaint = true;
                 }
             }
             if (repaint && !fromSwing) {
                 //no problems here, since repaint() is thread safe
                 return;
             }
             exception.printStackTrace();
         }
     }
}
