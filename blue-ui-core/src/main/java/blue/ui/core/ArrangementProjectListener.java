package blue.ui.core;

import blue.Arrangement;
import blue.ArrangementEvent;
import blue.ArrangementListener;
import blue.projects.BlueProject;
import blue.projects.BlueProjectManager;
import blue.ui.core.mixer.ArrangementMixerSynchronizer;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.lang.reflect.InvocationTargetException;
import javax.swing.SwingUtilities;

final class ArrangementProjectListener implements PropertyChangeListener, ArrangementListener {

    private BlueProject currentProject;
    private Arrangement currentArrangement;

    @Override
    public void propertyChange(PropertyChangeEvent evt) {
        if (BlueProjectManager.CURRENT_PROJECT.equals(evt.getPropertyName())) {
            setCurrentProject((BlueProject) evt.getNewValue());
        }
    }

    void setCurrentProject(BlueProject project) {
        Arrangement newArrangement = project == null ? null
                : project.getData().getArrangement();

        if (currentProject == project && currentArrangement == newArrangement) {
            runOnEdtAndWait(this::synchronizeCurrentProject);
            return;
        }

        if (currentArrangement != null) {
            currentArrangement.removeArrangementListener(this);
        }

        currentProject = project;
        currentArrangement = newArrangement;

        if (currentArrangement != null) {
            currentArrangement.addArrangementListener(this);
        }

        runOnEdtAndWait(this::synchronizeCurrentProject);
    }

    void detach() {
        setCurrentProject(null);
    }

    @Override
    public void arrangementChanged(ArrangementEvent arrEvt) {
        if (currentProject == null) {
            return;
        }

        Runnable update = switch (arrEvt.getType()) {
            case ArrangementEvent.INSTRUMENT_ID_CHANGED ->
                () -> ArrangementMixerSynchronizer.synchronizeInstrumentIdChange(
                        currentProject.getData().getMixer(),
                        currentArrangement,
                        arrEvt.getOldId(),
                        arrEvt.getNewId());
            case ArrangementEvent.UPDATE ->
                this::synchronizeCurrentProject;
            default ->
                null;
        };

        if (update == null) {
            return;
        }

        runOnEdtAndWait(update);
    }

    private void synchronizeCurrentProject() {
        if (currentProject == null || currentArrangement == null) {
            return;
        }

        ArrangementMixerSynchronizer.synchronize(
                currentProject.getData().getMixer(),
                currentArrangement);
    }

    private static void runOnEdtAndWait(Runnable runnable) {
        if (SwingUtilities.isEventDispatchThread()) {
            runnable.run();
            return;
        }

        try {
            SwingUtilities.invokeAndWait(runnable);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(
                    "Interrupted while synchronizing the mixer with the arrangement",
                    ex);
        } catch (InvocationTargetException ex) {
            throw new IllegalStateException(
                    "Failed to synchronize the mixer with the arrangement",
                    ex.getCause());
        }
    }
}
