'use client';

/**
 * Digital Access tab — list of granted services + revoke action.
 *
 * Pure presentation. The Grant modal and the revoke API call live in the
 * parent (client.tsx) so this component doesn't need to own session/auth
 * concerns; it just renders the rows and calls back when something happens.
 */

interface DigitalAccessRow {
  id: number;
  serviceName: string;
  accountId: string | null;
  grantedDate: Date | string;
  isActive: boolean;
}

interface Props {
  digitalAccess: DigitalAccessRow[];
  onGrantClick: () => void;
  onRevoke: (accessId: number) => void;
}

export default function DigitalAccessTab({
  digitalAccess,
  onGrantClick,
  onRevoke,
}: Props) {
  return (
    <div className="card">
      <div className="card-header flex justify-between items-center">
        <h3 className="section-heading">Digital Access & Licenses</h3>
        <button onClick={onGrantClick} className="btn btn-sm btn-primary">
          Grant Access
        </button>
      </div>
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Service</th>
              <th>Account ID</th>
              <th>Granted Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {digitalAccess.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-gray-500">
                  No digital access records
                </td>
              </tr>
            ) : (
              digitalAccess.map((da) => (
                <tr key={da.id}>
                  <td className="font-semibold">{da.serviceName}</td>
                  <td>{da.accountId || '-'}</td>
                  <td>{new Date(da.grantedDate).toLocaleDateString()}</td>
                  <td>
                    <span className={`badge ${da.isActive ? 'badge-green' : 'badge-red'}`}>
                      {da.isActive ? 'Active' : 'Revoked'}
                    </span>
                  </td>
                  <td>
                    {da.isActive && (
                      <button
                        onClick={() => onRevoke(da.id)}
                        className="btn btn-sm btn-danger"
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
